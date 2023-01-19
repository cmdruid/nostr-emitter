import WebSocket         from 'ws'
import { Hash }          from '@/class/hash'
import { KeyPair }       from '@/class/keypair'
import { EventEmitter }  from '@/class/emitter'
import { Subscription }  from '@/class/subscription'
import { SignedEvent }   from '@/class/event/SignedEvent'
import { Hex }           from '@/lib/format'
import { validateEvent } from '@/lib/validate'

import { 
  Transformer, 
  Middleware 
} from '@/class/transformer'

import {
  ClientConfig,
  Event,
  EventDraft,
  EventTemplate,
  Filter,
  ClientOptions,
  Tag,
  AckEnvelope,
  Sorter,
  TopicOptions
} from '@/schema/types'
import { TopicEmitter } from './topic'

type ClientTransformer = Transformer<SignedEvent, NostrClient>
type ClientMiddleware  = Middleware<SignedEvent, NostrClient>

export class NostrClient extends EventEmitter <{
  // Type mapping for our client event emitter.
  'ready'  : [ NostrClient ],
  'notice' : [ string      ],
  'info'   : [ string      ],
  'debug'  : [ string      ],
  'error'  : [ unknown     ],
  [k : string ] : any
}> {
  public  readonly id         : string
  public  readonly middleware : ClientTransformer

  private keypair     : KeyPair
  public  address    ?: string
  public  socket     ?: WebSocket
  public  filter      : Filter
  public  options     : ClientOptions
  public  tags        : Tag[][]
  public  ready       : boolean

  public static defaults = {
    kind    : 29001,  // Default event type.
    tags    : [],     // Global tags for events.
    selfsub : false,  // React to self-published events.
    timeout : 5000,   // Timeout on relay events.
    filter  : { since: Math.floor(Date.now() / 1000) }
  }

  constructor (options : ClientConfig = {}) {
    const { privkey = Hex.random(32), ...rest } = options
    super()
    this.id         = Hex.random(16)
    this.keypair    = new KeyPair(privkey)
    this.middleware = new Transformer(this as NostrClient)
    this.options    = { ...NostrClient.defaults, ...rest }
    this.tags       = this.options.tags
    this.ready      = false
    this.filter     = {
      kinds: [ this.options.kind ],
      ...this.options.filter
    }

    this.middleware.use(validateEvent)
    this.middleware.catch((err) => this.emit('error', err))
  }

  get initialized () : boolean {
    return this.socket !== undefined
  }

  get connected () : boolean {
    return (
      this.socket !== undefined &&
      this.socket.readyState === 1 &&
      this.ready
    )
  }

  get prvkey () : string {
    return this.keypair.prvkey
  }

  set prvkey (key : string | Uint8Array) {
    this.keypair = new KeyPair(key)
  }

  get pubkey () : string {
    return this.keypair.pubkey
  }

  private _openHandler (_event : WebSocket.Event) : void {
    /** Handles the websocket open event. */
    this.ready = true
    this.emit('info', `[ Client ] Connected to: ${String(this.address)}`)
    this.emit('ready', this)
  }

  private async _messageHandler (
    { data } : WebSocket.MessageEvent
  ) : Promise<void> {
     /** Handles all websocket message events. */
    try {
      if (typeof data !== 'string') {
        // If data is not a string for some reason,
        // treat it as a buffer object instead.
        data = data.toString('utf8')
      }

      this.emit('debug', `[ Socket ] Received: ${data}`)

      const message = JSON.parse(data)
      const type    = String(message[0])

      if (type === 'EOSE' || type === 'EVENT') {
        // These two event types reference a subId.
        const subId = String(message[1])

        if (this.hasTopic(subId)) {
          // If the subscription exists in the store,
          if (type === 'EOSE') {
            // If end-of-subscription message
            // emit with the subId as topic.
            return this.emit(subId, 'eose')
          }
          if (type === 'EVENT') {
            // If event message, process the raw event.
            const event = new SignedEvent(message[2], this)
            // Run the event through our middle-ware.
            const { ok, data } = await this.middleware.apply(event)
            // If data is ok, emit to the subId topic.
            if (ok) this.emit(subId, 'event', data)
            return
          }
          // Else, the subscription no longer exists.
          // We send a polite cancel message to the relay.
        } else { this.cancel(subId); return }
      }
      if (type === 'OK') {
        // If an ack message, break down the message.
        const [ eventId, ok, ...rest ] = message.slice(1)
        // Emit results with the eventId as a topic.
        return this.emit(eventId, ok, rest)
      }
      if (type === 'NOTICE') {
        // If we get a message from the relay, emit it directly.
        return this.emit('notice', message.slice(1))
      }
      // We shouldn't get to this point.
      throw TypeError(`Invalid type from relay: ${type}`)
    } catch (err) { this.emit('error', err) }
  }

  public async importSeed(string : string) {
    this.keypair = await KeyPair.fromSecret(string)
  }

  public use (fn : ClientMiddleware) : number {
    /** Add function to client middleware. */
    return this.middleware.use(fn)
  }

  public async connect (address ?: string) : Promise<NostrClient> {
    /** Configure our emitter for connecting to the relay network. */

    if (address !== undefined) {
      // If an address is provided, create a new socket with the address.
      this.ready   = false
      this.address = (address.includes('://')) ? address : 'wss://' + address
      this.socket  = new WebSocket(this.address)

      this.socket.addEventListener(

        /* Listener for the websocket open event. */
        'open', (event : WebSocket.Event) => { this._openHandler(event) }
      )

      this.socket.addEventListener(
        /* Listener for the websocket message event. */
        'message', (event : WebSocket.MessageEvent) => { this._messageHandler(event) }
      )
    }

    if (this.address === undefined) {
      // If address is undefined, halt.
      throw new Error('Must provide a url to a relay!')
    }

    // Return a promise that includes a timeout.
    return new Promise((resolve, reject) => {
      const address = String(this.address)
      const timeout = this.options.timeout
      // If socket is connected, resovle early,
      if (this.connected) resolve(this)
      setInterval(() => { if (this.connected) resolve(this) }, 500)
      // If the connection fails to resolve in time, throw rejection.
      setTimeout(() => reject(Error(`Connection to ${address} timed out!`)), timeout)
    })
  }

  public subscribe(filter ?: Filter) {
    return new Subscription(this, filter)
  }

  public topic(topic : string, options ?: TopicOptions) {
    return new TopicEmitter(this, topic, options)
  }

  public async query (
    filter  : Filter,
    sorter ?: Sorter<SignedEvent>
  ) : Promise<SignedEvent[]> {
    /** 
     *  Create a one-time subscription that collects all
     *  events and returns then in an array. This process
     *  can be used to query data from a relay.
     */
    const selection : SignedEvent[] = []
    const sub = new Subscription(this, filter)
    sub.on('eose', () => sub.cancel())
    sub.on('event', (event) => void selection.push(event))
    await sub.update()
    if (sorter !== undefined) selection.sort(sorter)
    return selection
  }

  public cancel (subId : string) : void {
    /** Send a subscription cancellation notice to the relay. */
    const message = JSON.stringify([ 'CLOSE', subId ])
    this.socket?.send(message)
    this.clearEvent(subId)
  }

  public async publish (
    draft : EventDraft
  ) : Promise<AckEnvelope | undefined> {
    /** Publish an event message to the relay. */

    const signedEvent = await this.sign({
      // We are constructing a template of the event
      // that is needed for hashing and signing.
      content    : draft.content ?? '',
      created_at : Math.floor(Date.now() / 1000),
      kind       : draft?.kind ?? this.options.kind,
      tags       : [ ...this.tags, ...draft.tags ?? [] ],
      pubkey     : this.pubkey
    })

    return new Promise((resolve) => {
      // Attach a temporary listener with the eventId as 
      // topic, in case the relay sends an 'OK' response.
      const message = JSON.stringify([ 'EVENT', signedEvent ])
      const timeout = this.options.timeout
      this.within('OK', (ack : AckEnvelope) => {
        const [ eventId ] = ack
        if (eventId === signedEvent.id) resolve(ack)
      }, timeout)
      setTimeout(() => resolve(undefined), timeout)
      this.send(message)
      this.emit('sent', signedEvent)
    })
}

  public async sign (
    event : EventTemplate
  ) : Promise<Event> {
    /** 
     * Produce a hashed digest of the event data,
     * then return event with hash and signature.
     */
    const preimage = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ])

    // Append event ID and signature
    const id  = await Hash.from(preimage).hex
    const sig = await this.keypair.sign(id)

    // Verify that the signature is valid.
    if (!await this.keypair.verify(id, sig)) {
      throw TypeError('Event failed verification!')
    }
    return { ...event, id, sig }
  }

  public async send (
    message : string
  ) : Promise<void> {
    /** Send a raw message payload to the relay. */
    await this.connect()
    // Send the serialized message to the relay.
    this.socket?.send(message)
    this.emit('info', `[ Client ] Sent: ${message}`)
  }

  public close() {
    this.emit('info', '[ Client ] Closing socket connection...')
    setTimeout(() => {
      if (this.connected) this.socket?.close()
      if (typeof process === 'object' && process !== undefined) process.exit()
    }, 2000)
  }
}

import WebSocket        from 'ws'
import { Hex }          from './format.js'
import { Hash }         from './hash.js'
import { KeyPair }      from './keypair.js'
import { SignedEvent }  from './event.js'
import { Subscription } from './subscription.js'
import { EventEmitter } from './emitter.js'

import { 
  Transformer, 
  Middleware 
} from './transformer.js'

import {
  Config,
  Event,
  EventDraft,
  EventTemplate,
  Filter,
  Json,
  Options,
  Tag,
  AckEnvelope,
  Sorter
} from './types.js'
import { validateEvent } from './middleware/default.js'

// Default options to use.
const DEFAULT_OPT = {
  kind    : 29001,  // Default event type.
  tags    : [],     // Global tags for events.
  selfsub : false,  // React to self-published events.
  timeout : 5000,   // Timeout on relay events.
  filter  : { since: Math.floor(Date.now() / 1000) }
}

export class NostrClient extends EventEmitter<any> {
  // Our main class object.

  private readonly keypair    : KeyPair
  public  readonly id         : string
  public  readonly subs       : Map<string, Subscription<any>>
  public  readonly middleware : Transformer<SignedEvent>

  public  address    ?: string
  public  socket     ?: WebSocket
  public  filter      : Filter
  public  options     : Options
  public  tags        : Tag[][]

  constructor (
    passkey  : string | Uint8Array,
    options ?: Config
  ) {
    super()
    this.id         = Hex.random(32)
    this.keypair    = new KeyPair(passkey)
    this.subs       = new Map()
    this.middleware = new Transformer()
    this.options    = { ...DEFAULT_OPT, ...options }
    this.tags       = this.options.tags
    this.filter     = {
      kinds: [ this.options.kind ],
      ...this.options.filter
    }

    this.middleware.use(validateEvent)
    this.middleware.catch((err) => this.emit('error', err))
  }

  get connected () : boolean {
    return (
      this.socket !== undefined &&
      this.socket.readyState === 1
    )
  }

  get prvkey () : string {
    return this.keypair.prvkey
  }

  get pubkey () : string {
    return this.keypair.pubkey
  }

  get ready () : boolean {
    return this.socket?.readyState === 1
  }

  private socketHandler(address : string) : void {
    this.address = (address.includes('wss://'))
        ? address
        : 'wss://' + address

    this.socket = new WebSocket(this.address)

    this.socket.addEventListener(
      // Listener for the websocket open event.
      'open', (event : WebSocket.Event) => { this.openHandler(event) }
    )

    this.socket.addEventListener(
      // Listener for the websocket message event.
      'message', (event : WebSocket.MessageEvent) => { this.messageHandler(event) }
    )
  }

  private openHandler (_event : WebSocket.Event) : void {
    /** Handle the websocket open event.
     */
    this.emit('ready', this)
    this.emit('info', `Connected to ${String(this.address)}`)
  }

  private async messageHandler (
    { data } : WebSocket.MessageEvent
  ) : Promise<void> {
     /** Handle the websocket message event. */
    try {
      if (typeof data !== 'string') {
        data = data.toString('utf8')
      }

      this.emit('debug', `[ Socket ] Received: ${data}`)

      const message = JSON.parse(data)
      const type    = String(message[0])

      if (type === 'EOSE' || type === 'EVENT') {
        const subId = String(message[1])
        if (this.subs.has(subId)) {
          if (type === 'EOSE') {
            this.emit('eose', subId)
            this.emit('info', `[ Socket ] Subscription Id: ${subId}`)
            return
          }
          if (type === 'EVENT') {
            const json  = message[2]
            const event = new SignedEvent(json, this)
            const { ok, data } = await this.middleware.apply(event)
            if (ok) {
              this.emit(subId, data)
              this.emit('info', `[ Socket ] Incoming Event: ${JSON.stringify(event, null, 2)}`)
              return
            } else { return }
          }
        } else { this.cancel(subId); return }
      }
      if (type === 'OK' || type === 'NOTICE') {
        this.emit('info', `[ Socket ] Incoming Message: ${JSON.stringify(message)}`)
        this.emit(type, message.slice(1))
        return
      }
      throw TypeError(`Invalid type from relay: ${type}`)
    } catch (err) { this.emit('error', err) }
  }

  private subHandler () : void {
    for (const sub of this.subs.values()) {
      if (!sub.subscribed) void sub.connect()
    }
  }

  public use (fn : Middleware<SignedEvent<Json>>) : number {
    /** Add function to client middleware.
     */
    return this.middleware.push(fn)
  }

  public async connect (
    address ?: string
  ) : Promise<NostrClient> {
    /** Configure our emitter for connecting to
     *  the relay network.
     * */

    if (address !== undefined) {
      this.socketHandler(address)
    }

    if (this.address === undefined) {
      throw new Error('Must provide a url to a relay!')
    }

    // Return a promise that includes a timeout.
    return new Promise((resolve, reject) => {
      const address = String(this.address)
      const timeout = this.options.timeout
      if (this.connected) {
        this.subHandler()
        resolve(this)
      }
      this.within('ready', client => {
        if (client.address === address) {
          this.subHandler()
          resolve(this)
        }
      }, timeout)
      setTimeout(() => {
        reject(Error(`Connection to ${address} timed out!`))
      }, timeout)
    })
  }

  public subscribe<T = Json> (
    filter : Filter = this.filter
  ) : Subscription<T> {
    /** Send a subscription message to the socket peer.
     * */
    const sub = new Subscription<T>(filter, this)
    this.subs.set(sub.id, sub)
    return sub
  }

  public async query<T = Json>(
    filter  : Filter,
    sorter ?: Sorter<SignedEvent<T>>
  ) : Promise<SignedEvent<T>[]> {
    const selection : SignedEvent<T>[] = []
    const sub = this.subscribe<T>(filter)
    sub.on('event', (event) => {
      if (event instanceof SignedEvent) {
        void selection.push(event)
      }
    })
    await sub.connect()
    sub.cancel()
    if (sorter !== undefined) selection.sort(sorter)
    return selection
  }

  public cancel (subId : string) : boolean {
    const message = JSON.stringify([ 'CLOSE', subId ])
    this.socket?.send(message)
    return this.subs.delete(subId)
  }

  public async relay<T = Json> (
    draft : EventDraft<T>
  ) : Promise<AckEnvelope | undefined> {
    /** Send a data message to the relay. */
    return this.send({
      content    : draft.content,
      created_at : Math.floor(Date.now() / 1000),
      kind       : draft?.kind ?? this.options.kind,
      tags       : [ ...this.tags, ...draft.tags ?? [] ],
      pubkey     : this.pubkey
    })
  }

  public async sign<T = Json> (
    event : EventTemplate<T>
  ) : Promise<Event<T>> {
    /** Produce a signed hash of our event,
     *  then attach it to the event object.
     * */
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

  public async send<T = Json> (
    event : EventTemplate<T>
  ) : Promise<AckEnvelope | undefined> {
    // Sign our message.
    const signedEvent = await this.sign(event)

    // Serialize and send our message.
    const message = JSON.stringify([ 'EVENT', signedEvent ])
    await this.connect()
    this.socket?.send(message)
    this.emit('info', `Sent event: ${JSON.stringify(event, null, 2)}`)
    this.emit('sent', signedEvent)

    return new Promise((resolve) => {
      const timeout = this.options.timeout
      this.within('OK', ack => {
        if (ack.eventId === signedEvent.id) resolve(ack)
      }, timeout)
      setTimeout(() => { resolve(undefined) }, timeout)
    })
  }
}

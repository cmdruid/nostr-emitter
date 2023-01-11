import WebSocket   from 'ws'

import { Cipher }  from './cipher.js'
import { Hex, Text }     from './format.js'
import { Hash }    from './hash.js'
import { KeyPair } from './keypair.js'
import { SignedEvent } from './event.js'

import {
  EventEmitter,
  NostrEmitter
} from './emitter.js'

import {
  Config,
  Event,
  EventDraft,
  ContentEnvelope,
  EventTemplate,
  Filter,
  Json,
  Options,
  Tag
} from './types.js'

// Default options to use.
const DEFAULT_OPT = {
  kind    : 29001,  // Default event type.
  tags    : [],     // Global tags for events.
  selfsub : false,  // React to self-published events.
  silent  : false,  // Silence noisy output.
  verbose : false,  // Show verbose log output.
  filter  : { since: Math.floor(Date.now() / 1000) }
}

export class NostrClient<T = Json> extends EventEmitter<any> {
  // Our main class object.

  private readonly keypair : KeyPair
  public  readonly event   : NostrEmitter<T>

  private secret     ?: Uint8Array
  public  hashtag    ?: string
  public  address    ?: string
  public  socket     ?: WebSocket
  public  subId      ?: string
  public  connected   : boolean
  public  subscribed  : boolean
  public  filter      : Filter
  public  options     : Options
  public  tags        : Tag[][]

  constructor (
    passkey  : string | Uint8Array,
    options ?: Config
  ) {
    super()
    this.keypair    = new KeyPair(passkey)
    this.event      = new NostrEmitter(this)
    this.connected  = false
    this.subscribed = false

    this.options    = { ...DEFAULT_OPT, ...options }
    this.tags       = this.options.tags
    this.filter     = {
      kinds: [ this.options.kind ],
      ...this.options.filter
    }
  }

  get prvkey () : string {
    return this.keypair.prvkey
  }

  get pubkey () : string {
    return this.keypair.pubkey
  }

  get cipher () : Cipher | undefined {
    return (this.secret !== undefined)
      ? new Cipher(this.secret)
      : undefined
  }

  get ready () : boolean {
    return this.socket?.readyState === 1
  }

  private openHandler (_event : WebSocket.Event) : void {
    /** Handle the websocket open event.
     */
    this.emit('info', `Connected to ${String(this.address)}`)
    this.connected = true
    this.subscribe()
  }

  private messageHandler ({ data } : WebSocket.MessageEvent) : void {
     /** Handle the websocket message event.
      */
    try {
      if (typeof data !== 'string') {
        data = data.toString('utf8')
      }

      this.emit('debug', `[ Socket ] Received: ${data}`)

      const message = JSON.parse(data)
      const type    = String(message[0])

      if (type === 'EOSE' || type === 'EVENT') {
        const subId = String(message[1])
        if (subId === this.subId) {
           if (type === 'EOSE') {
            this.subscribed = true
            this.emit('info', `[ Socket ] Subscription Id: ${subId}`)
            return
          }
          if (type === 'EVENT') {
            // add a pipe here :-)
            const event = message[2]
            const signed = new SignedEvent(event, this)
            this.emit('info', `[ Socket ] Incoming Event: ${JSON.stringify(event, null, 2)}`)
            void this.eventHandler(signed)
            return
          }
        } else {
          this.cancel(subId)
          return
        }
      }

      if (type === 'OK' || type === 'NOTICE') {
        this.emit('info', `[ Socket ] Incoming Message: ${JSON.stringify(message)}`)
        this.emit(type, message.slice(1))
        return
      }

      throw TypeError(`Invalid type from relay: ${type}`)
    } catch (err) { this.emit('error', err) }
  }

  async eventHandler (event : SignedEvent<T>) : Promise<void> {
    // Verify that the signature is valid.

    if (!await event.isValid) {
      throw TypeError('Event signature failed verification!')
    }

    // If the event is from ourselves, check the filter rules.
    if (event.isAuthor && !this.options.selfsub) return

    let content : ContentEnvelope<T> | T  | string = event.content

    if (event.isDecipherable) {
      content = await event.decrypt()
    }

    if (typeof content === 'string') {
      content = Text.revive(content)
    }

    this.emit('debug', content)
    this.emit('debug', event)

    // If the decrypted content is empty, destroy the event.
    if (Array.isArray(content)) {
      // Apply the event to our subscribed functions.
      const [ eventName, eventData ] = content
      this.event.emit(eventName, eventData, event)
    } else { this.event.emit('any', content as T, event) }
  }

  async connect (
    address : string,
    secret ?: string
  ) : Promise<NostrEmitter<T>> {
    /** Configure our emitter for connecting to
     *  the relay network.
     * */

    if (address === undefined) {
      throw new Error('Must provide url to a relay!')
    }

    if (secret !== undefined) {
      this.secret  = await Hash.from(secret).raw
      this.hashtag = await new Hash(this.secret).hex
    } else {
      this.secret  = undefined
      this.hashtag = await Hash.from(address).hex
    }

    this.filter['#h'] = [ this.hashtag ]
    this.address = (address.includes('wss://')) ? address : 'wss://' + address
    this.socket  = new WebSocket(this.address)

    this.socket.addEventListener(
      // Listener for the websocket open event.
      'open', (event : WebSocket.Event) => { this.openHandler(event) }
    )

    this.socket.addEventListener(
      // Listener for the websocket message event.
      'message', (event : WebSocket.MessageEvent) => { this.messageHandler(event) }
    )

    // Return a promise that includes a timeout.
    return new Promise((resolve, reject) => {
      let   count    = 0
      const retries  = 10
      const interval = setInterval(() => {
        if (this.connected && this.subscribed) {
          clearInterval(interval)
          this.emit('ready', this.event)
          resolve(this.event)
        } else if (count > retries) {
          clearInterval(interval)
          this.emit('timeout', this)
          reject(this.address)
        } else {
          count++
        }
      }, 500)
    })
  }

  public subscribe (
    filter : Filter = this.filter
  ) : void {
    /** Send a subscription message to the socket peer.
     * */
    const subId   = Hex.random(32)
    const message = JSON.stringify([ 'REQ', subId, filter ])
    this.socket?.send(message)
    this.subId = subId
  }

  public cancel (subId : string) : void {
    const message = JSON.stringify([ 'CLOSE', subId ])
    this.socket?.send(message)
  }

  public async relay (
    eventName : string | null,
    content   : T | string,
    template  : EventDraft<T> = { tags: [] }
  ) : Promise<void> {
    /** Send a data message to the relay. */
    if (eventName !== null) {
      content = JSON.stringify([ eventName, content ])
    }

    if (typeof content !== 'string') {
      content = JSON.stringify(content)
    }

    if (this.cipher !== undefined) {
      content = await this.cipher.encrypt(content)
      template.tags.push([ 'h', await this.cipher.hashtag ])
    }

    return this.send({
      content,
      created_at : Math.floor(Date.now() / 1000),
      kind       : template?.kind ?? this.options.kind,
      tags       : [ ...this.tags, ...template.tags ],
      pubkey     : this.pubkey
    })
  }

  async send (event : EventTemplate) : Promise<void> {
    // Sign our message.
    const signedEvent = await this.signEvent(event)

    // Serialize and send our message.
    const message = JSON.stringify([ 'EVENT', signedEvent ])
    this.socket?.send(message)
    this.emit('info', `Sent event: ${JSON.stringify(event, null, 2)}`)
    this.emit('sent', signedEvent)
  }

  async signEvent (event : EventTemplate) : Promise<Event> {
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
}

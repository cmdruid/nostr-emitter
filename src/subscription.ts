import { NostrClient }  from './client.js'
import { EventEmitter } from './emitter.js'
import { SignedEvent } from './event.js'
import { Hex }         from './format.js'

import { 
  Transformer, 
  Middleware 
} from './transformer.js'

import {
  AckEnvelope,
  Event,
  EventDraft,
  Filter,
  Json,
  Sorter
} from './types.js'

type EventParams<T> = [
  event : Event<T> | SignedEvent<T> | SignedEvent<T>[] | ThisType<Subscription<T>>
]

export class Subscription<T = Json> extends EventEmitter<EventParams<T>> {
  private readonly client     : NostrClient
  public  readonly id         : string
  public  readonly filter     : Filter
  public  readonly middleware : Transformer<SignedEvent<T>>
  public subscribed           : boolean

  constructor (
    filter : Filter,
    client : NostrClient
  ) {
    super()
    this.id     = Hex.random(32)
    this.filter = filter
    this.client = client
    this.middleware = new Transformer()
    this.subscribed = false
  }

  private eventHandler (...args : EventParams<T>) : void {
    void this.emit('event', ...args)
  }

  public use (fn : Middleware<SignedEvent<T>>) : number {
    /** Add function to client middleware.
     */
    return this.middleware.push(fn)
  }

  public async connect () : Promise<Subscription<T>> {
    return new Promise((resolve, reject) => {
      if (this.subscribed) resolve(this)
      const message = JSON.stringify([ 'REQ', this.id, this.filter ])
      const timeout = this.client.options.timeout
      this.client.within('eose', (subId) => {
        if (subId === this.id) {
          this.subscribed = true
          this.client.on(this.id, this.eventHandler.bind(this))
          this.emit('ready', this)
          resolve(this)
        }
      }, timeout)
      this.client.socket?.send(message)
      setTimeout(() => {
        reject(Error(`Subscription Id ${this.id} timed out!`))
      }, timeout)
    })
  }

  public async query<T = Json> (
    filter  : Filter = this.filter,
    sorter? : Sorter<SignedEvent<T>>
  ) : Promise<SignedEvent<T>[]> {
    return this.client.query(filter, sorter)
  }

  public async relay (
    draft : EventDraft<T>
  ) : Promise<AckEnvelope | undefined> {
    return this.client.relay<T>(draft)
  }

  public async update (
    filter : Filter = this.filter
  ) : Promise<Subscription> {
    this.cancel()
    return this.client.subscribe(filter)
  }

  public cancel () : void {
    this.client.cancel(this.id)
    this.client.remove(this.id, this.eventHandler)
  }
}

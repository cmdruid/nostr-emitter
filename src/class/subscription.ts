import { NostrClient }  from '@/class/client'
import { EventEmitter } from '@/class/emitter'
import { SignedEvent }  from '@/class/event/SignedEvent'
import { Hex }          from '@/lib/format'
import { Filter }       from '@/schema/types'

type UpdateHook = () => Promise<void>

export class Subscription extends EventEmitter<{
  'ready' : [ Subscription ]
  'event' : [ SignedEvent  ]
  [ k : string ] : any[]
}> {

  public readonly client : NostrClient
  public readonly id     : string

  public filter      : Filter
  public _updateHook : UpdateHook
  public subscribed  : boolean

  constructor (
    client : NostrClient,
    filter : Filter = client.filter
  ) {
    super()
    this.id     = Hex.random(16)
    this.client = client
    this.filter = filter
    this.subscribed = false
    this._updateHook = () => new Promise((res) => res())

    this.client.on(this.id, this._eventHandler.bind(this))
    this.client.on('ready', () => {
      this._updateHook().then(() => this.update())
    })
  }

  async _eventHandler (type : string, ...args : any[]) : Promise<void> {
    /** Handle incoming events from the client emitter. */
    this.emit(type, ...args)
  }

  // public async activate() : Promise<void> {
  //   /** Activate a new subscription. */
  //   if (!this.subscribed) await this.update()
  // }

  public async update (filter : Filter = this.filter) : Promise<void> {
    /** send a subscription request to the relay. */
    return new Promise((resolve, reject) => {
      // Configure our message payload and timeout.
      const message = JSON.stringify([ 'REQ', this.id, filter ])
      const timeout = this.client.options.timeout
      const errmsg  = Error(`Subscription ${this.id} timed out!`)
      const timer   = setTimeout(() => reject(errmsg), timeout)
      this.within('eose', () => {
        // If we receive an eose event,
        // the subscription is ready.
        this.subscribed = true
        this.emit('ready', this)
        resolve(clearTimeout(timer))
      }, timeout)
      // Send the subscription request to the relay.
      this.client.send(message)
    })
  }

  public cancel () : void {
    /** Cancels the subscription. */
    this.client.cancel(this.id)
  }
}

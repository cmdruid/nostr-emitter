/**
 *  EventEmitter
 *
 *  Type-safe implementation of a
 *  standard event emitter object.
 *
 * */

import { NostrClient }   from './client.js'
import { EventEnvelope, Json } from './types.js'

type EventParams<T> = T & unknown[]
type EventMethod<T> = (...args : EventParams<T>) => void | Promise<void>
type FunctionSet<T> = Set<EventMethod<T>>
type FunctionMap<T> = Map<String, FunctionSet<T>>

export class EventEmitter<T = unknown[]> {
  private readonly _events : FunctionMap<T>

  constructor () {
    this._events = new Map([ [ 'all', new Set() ] ])
  }

  _getFn (eventName : string) : FunctionSet<T> {
    /** If key undefined, create a new set for the event,
     *  else return the stored subscriber list.
     * */
    let events = this._events.get(eventName)
    if (events === undefined) {
      events = new Set()
      this._events.set(eventName, events)
    }
    return events
  }

  public on (eventName : string, fn : EventMethod<T>) : void {
    /** Subscribe function to run on a given event. */
    this._getFn(eventName).add(fn)
  }

  public once (eventName : string, fn : EventMethod<T>) : void {
    /** Subscribe function to run once, using
     *  a callback to cancel the subscription.
     * */

    const onceFn = (...args : EventParams<T>) : void => {
      this.remove(eventName, onceFn)
      void fn.apply(this, args)
    }

    this.on(eventName, onceFn)
  }

  public within (
    eventName : string,
    fn : EventMethod<T>,
    timeout : number
  ) : void {
    /** Subscribe function to run within a given,
     *  amount of time, then cancel the subscription.
     * */
    const withinFn = (...args : EventParams<T>) : void => {
      void fn.apply(this, args)
    }
    setTimeout(() => { this.remove(eventName, withinFn) }, timeout)

    this.on(eventName, withinFn)
  }

  public emit (eventName : string, ...args : EventParams<T>) : void {
    /** Emit a series of arguments for the event, and
     *  present them to each subscriber in the list.
     * */
    const allEvents = [
      ...this._getFn(eventName),
      ...this._getFn('all')
    ]

    allEvents.forEach((fn : EventMethod<T>) => {
      void fn.apply(this, args)
    })
  }

  public remove (eventName : string, fn : EventMethod<T>) : void {
    /** Remove function from an event's subscribtion list. */
    this._getFn(eventName).delete(fn)
  }
}

export class NostrEmitter<T = Json> extends EventEmitter<EventEnvelope<T>> {
  private readonly client : NostrClient<any>

  constructor (client : NostrClient<T>) {
    super()
    this.client = client
  }

  get relay () : typeof this.client.relay {
    return this.client.relay.bind(this.client)
  }

  get subscribe () : typeof this.client.subscribe {
    return this.client.subscribe.bind(this.client)
  }

  get cancel () : typeof this.client.cancel {
    return this.client.cancel.bind(this.client)
  }
}

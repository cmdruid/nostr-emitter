/**
 *  ## EventEmitter
 *
 *  Type-safe implementation of a
 *  standard event emitter object.
 *
 * */

export type EventMap = Record<string, any>

type EventKey<S extends EventMap> = string & keyof S
type EventMethod<S> = (...args: S & any[]) => void

export class EventEmitter<S extends EventMap = unknown[]> {
  readonly _events : Map<keyof EventMap, Set<Function>>

  constructor () { this._events = new Map() }

  _getHandlers (eventName : string)  {
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

  public hasTopic(topic : string) : boolean {
    const res = this._events.get(topic)
    return (res instanceof Set && res.size > 0)
  }

  public on <K extends EventKey<S>> (
    eventName : K, fn : EventMethod<S[K]>
  ) : void {
    /** Subscribe function to run on a given event. */
    this._getHandlers(eventName).add(fn)
  }

  public once <K extends EventKey<S>> (
    eventName : K, fn : EventMethod<S[K]>
  ) : void {
    /** Subscribe function to run once, using
     *  a callback to cancel the subscription.
     * */

    const onceFn = (...args : S[K]) : void => {
      this.removeHandler(eventName, onceFn)
      void fn.apply(this, args)
    }

    this.on(eventName, onceFn)
  }

  public within <K extends EventKey<S>> (
    eventName : K,
    fn        : EventMethod<S[K]>,
    timeout   : number
  ) : void {
    /** Subscribe function to run within a given,
     *  amount of time, then cancel the subscription.
     * */
    const withinFn = (...args : S[K]) : void => {
      void fn.apply(this, args)
    }
    setTimeout(() => { this.removeHandler(eventName, withinFn) }, timeout)

    this.on(eventName, withinFn)
  }

  public emit <K extends EventKey<S>> (
    eventName : string, ...args : S[K]
  ) : void {
    /** Emit a series of arguments for the event, and
     *  present them to each subscriber in the list.
     * */
    this._getHandlers(eventName).forEach((fn : Function) => {
      // console.log(eventName, this)
      fn.apply(this, args)
    })

    this._getHandlers('ALL').forEach((fn : Function) => {
      fn.apply(this, [ eventName, ...args ])
    })

  }

  public removeHandler <K extends EventKey<S>> (
    eventName : K,
    fn : EventMethod<S[K]>
  ) : void {
    /** Remove function from an event's subscribtion list. */
    this._getHandlers(eventName).delete(fn)
  }

  public clearEvent(eventName : string) : void {
    this._events.delete(eventName)
  }
}

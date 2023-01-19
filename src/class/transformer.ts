/**
 *  Transformer
 *
 *  Type-safe implementation of a
 *  data pipe / transformer object.
 *
 * */

type TransformReturn<T, C> = (
  data    : T,
  context : C,
  err    ?: errorHandler
) => Promise<TransformOutput<T>>

export type Middleware<T, C> = (
  input   : T, 
  context : C
) => Promise<T | null> | T | null

export type errorHandler = (...args : unknown[]) => void

export interface TransformOutput<T> {
  ok   : boolean
  err  : unknown[]
  data : T
}

export class Transformer<T, C> {
  public readonly context : C
  public readonly methods : Array<Middleware<T, C>>
  public catcher ?: errorHandler
  
  constructor (context : C) {
    this.context = context
    this.methods = []
    this.catcher = undefined
  }

  public use (...fn : Array<Middleware<T, C>>) : number {
    return this.methods.push(...fn)
  }

  public async apply (data : T) : Promise<TransformOutput<T>> {
    return pipe(...this.methods)(data, this.context, this.catcher)
  }

  public catch (catcher : errorHandler) : void {
    this.catcher = catcher
  }
}

export function pipe<T, C> (
  ...fns : Array<Middleware<T, C>>
) : TransformReturn<T, C> {
  /**
   * Transform an input by piping it through
   * various methods. Includes type-guarding
   * and flow control.
   */
  return async (
    input    : T,
    context  : C,
    catcher ?: errorHandler
  ) => {
    // Define our outer state.
    const err = [], data = input
    let ret = null
    // For each method in the stack,
    for (const fn of fns) {
      // Attempt to resolve the method.
      try {
        // Pipe output back into input.
        ret = await fn(data, context)
        if (ret === null) {
          return { data, err, ok: false }
        }
      } catch (error) {
        // Something blew up.
        if (catcher !== undefined) {
          // Run error through the catcher.
          catcher(error, data, context)
        }
        // If catcher didn't throw,
        // log error and continue.
        err.push(error)
      }
    }
    return { data, err, ok: err.length === 0 }
  }
}

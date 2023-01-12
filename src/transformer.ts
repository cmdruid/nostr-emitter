/**
 *  Transformer
 *
 *  Type-safe implementation of a
 *  data pipe / transformer object.
 *
 * */

type TransformReturn<T> = (data : T, err ?: errorHandler) => Promise<TransformOutput<T>>

export type Middleware<T> = (input : T) => Promise<T | null> | T | null
export type errorHandler  = (...args : unknown[]) => void

export interface TransformOutput<T> {
  ok   : boolean
  err  : unknown[]
  data : T
}

export class Transformer<T> extends Array<Middleware<T>> {
  public catcher : errorHandler | undefined

  constructor (...fn : Array<Middleware<T>>) {
    super(...fn)
    this.catcher = undefined
  }

  public use (...fn : Array<Middleware<T>>) : number {
    return this.push(...fn)
  }

  public async apply (data : T) : Promise<TransformOutput<T>> {
      return pipe(...this)(data, this.catcher)
  }

  public catch (catcher : errorHandler) : void {
    this.catcher = catcher
  }
}

export function pipe<T> (
  ...fns : Array<Middleware<T>>
) : TransformReturn<T> {
  /**
   * Transform an input by piping it through
   * various methods. Includes type-guarding
   * and flow control.
   */
  return async (
    input    : T,
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
        ret = await fn(data)
        if (ret === null) {
          return { data, err, ok: false }
        }
      } catch (error) {
        // Something blew up.
        if (catcher !== undefined) {
          // Run error through the catcher.
          catcher(error, data)
        }
        // If catcher didn't throw,
        // log error and continue.
        err.push(error)
      }
    }
    return { data, err, ok: err.length === 0 }
  }
}

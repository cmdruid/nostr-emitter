import { Hex, Text } from './format.js'

export class Hash {
  private init : boolean
  private rnds : number
  private data : ArrayBuffer

  static from (string : string) : Hash {
    const bytes = Text.encode(string)
    return new Hash(bytes)
  }

  constructor (bytes : string | Uint8Array) {
    this.init = false
    this.rnds = 1
    this.data = Hex.normalize(bytes)
  }

  get raw () : Promise<Uint8Array> {
    return this.digest()
  }

  get hex () : Promise<string> {
    return this.raw.then(raw => Hex.encode(raw))
  }

  public rounds (num : number) : Hash {
    this.rnds = num
    return this
  }

  async digest () : Promise<Uint8Array> {
    if (!this.init) {
      for (let i = 0; i < this.rnds; i++) {
        this.data = await crypto.subtle.digest('SHA-256', this.data)
      }
      this.init = true
    }
    return new Uint8Array(this.data)
  }
}

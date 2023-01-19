import { Hex, Text } from '@/lib/format'

export class Hash {
  private init : boolean
  private rnds : number
  private data : ArrayBuffer

  static from (string : string) : Hash {
    // Create a hash digest from a string value.
    const bytes = Text.encode(string)
    return new Hash(bytes)
  }

  constructor (bytes : string | Uint8Array) {
    this.init = false
    this.rnds = 1
    this.data = Hex.normalize(bytes)
  }

  get raw () : Promise<Uint8Array> {
    // Return the raw bytes.
    return this.digest()
  }

  get hex () : Promise<string> {
    // Return the bytes formatted as hex.
    return this.raw.then(raw => Hex.encode(raw))
  }

  public rounds (num : number) : Hash {
    // Set the number of rounds 
    // to use for the digest.
    this.rnds = num
    return this
  }

  async digest () : Promise<Uint8Array> {
    if (!this.init) {
      // If this not initialized,
      for (let i = 0; i < this.rnds; i++) {
        // For number of set rounds, digest the raw data.
        this.data = await crypto.subtle.digest('SHA-256', this.data)
      }
      // Flag this as initialized.
      this.init = true
    }
    // Return the raw data.
    return new Uint8Array(this.data)
  }
}

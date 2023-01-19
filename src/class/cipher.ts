import { Hash }              from '@/class/hash'
import { Base64, Hex, Text } from '@/lib/format'

const crypto = globalThis.crypto

async function importKey (
  secret : string | Uint8Array
) : Promise<CryptoKey> {
  /** Derive a shared key-pair and import as a
   *  CryptoKey object (for Webcrypto library).
   */
  const cipher  : Uint8Array   = await new Hash(secret).raw
  const options : KeyAlgorithm = { name: 'AES-CBC' }
  const usage   : KeyUsage[]   = [ 'encrypt', 'decrypt' ]
  return crypto.subtle.importKey('raw', cipher, options, true, usage)
}

async function encrypt (
  message : string,
  secret  : string | Uint8Array
) : Promise<string> {
  /** Encrypt a message using a secret cipher. */
  const payload = Text.encode(message)
  const vector  = crypto.getRandomValues(new Uint8Array(16))
  const cipher  = await importKey(secret)
  const buffer  = await crypto.subtle
    .encrypt({ name: 'AES-CBC', iv: vector }, cipher, payload)
    .then((bytes) => new Uint8Array(bytes))
  // Return a concatenated and base64 encoded array.
  return Base64.encode(new Uint8Array([ ...vector, ...buffer ]))
}

async function decrypt (
  message : string,
  secret  : string | Uint8Array
) : Promise<string> {
  /** Decrypt an encrypted message using a CryptoKey object. */
  const buffer  = Base64.decode(message)
  const cipher  = await importKey(secret)
  const options = { name: 'AES-CBC', iv: buffer.slice(0, 16) }
  const decoded = await crypto.subtle.decrypt(options, cipher, buffer.slice(16))
  return Text.decode(new Uint8Array(decoded))
}

export class Cipher {
  private readonly secret : Uint8Array

  public static async from (
    string : string
  ) : Promise<Cipher> {
    const bytes = await Hash.from(string).raw
    return new Cipher(bytes)
  }

  constructor (secret : string | Uint8Array) {
    this.secret = Hex.normalize(secret)
  }

  get hashtag () : Promise<string> {
    return new Hash(this.secret).hex
  }

  public async encrypt (message : string) : Promise<string> {
    return encrypt(message, this.secret)
  }

  public async decrypt (message : string) : Promise<string> {
    return decrypt(message, this.secret)
  }
}

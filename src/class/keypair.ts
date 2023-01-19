import { schnorr } from '@noble/secp256k1'
import { Hash }    from '@/class/hash'
import { Hex }     from '@/lib/format'

async function sign (
  message    : string | Uint8Array,
  privateKey : string | Uint8Array
) : Promise<string> {
  const msg = Hex.normalize(message)
  const key = Hex.normalize(privateKey)
  return schnorr.sign(msg, key).then(raw => Hex.encode(raw))
}

async function verify (
  signature : string | Uint8Array,
  message   : string | Uint8Array,
  publicKey : string | Uint8Array
) : Promise<boolean> {
  const sig = Hex.normalize(signature)
  const msg = Hex.normalize(message)
  const key = Hex.normalize(publicKey)
  return schnorr.verify(sig, msg, key)
}

export class KeyPair {
  private readonly secret : Uint8Array

  public static random () : KeyPair {
    return new KeyPair(Hex.random(32))
  }

  public static async fromSecret (
    string : string
  ) : Promise<KeyPair> {
    const seed = await Hash.from(string).raw
    return new KeyPair(seed)
  }

  public static sign   = sign
  public static verify = verify

  constructor (bytes : string | Uint8Array) {
    this.secret = Hex.normalize(bytes)
  }

  public get prvkey () : string {
    return Hex.encode(this.secret)
  }

  public get pubraw () : Uint8Array {
    return schnorr.getPublicKey(this.secret)
  }

  public get pubkey () : string {
    return Hex.encode(this.pubraw)
  }

  public async sign (message : string) : Promise<string> {
    return sign(message, this.secret)
  }

  public async verify (
    message   : string,
    signature : string | Uint8Array
  ) : Promise<boolean> {
    return verify(signature, message, this.pubraw)
  }
}

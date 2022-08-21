const { schnorr } = nobleSecp256k1
const ec = new TextEncoder()
const dc = new TextDecoder()

export async function hash(string) {
  return crypto.subtle.digest('SHA-256', ec.encode(string))
    .then((bytes) => { return bytesToHex(new Uint8Array(bytes)) })
}

export async function genSignKeys(secret) {
  const privateKey = (secret)
    ? await crypto.subtle.digest('SHA-256', ec.encode(secret))
    : getRandomBytes(32)
  const publicKey = schnorr.getPublicKey(privateKey)
  return {
    private: bytesToHex(new Uint8Array(privateKey)),
    public: bytesToHex(new Uint8Array(publicKey))
  }
}

export function sign(msg, key) {
  return schnorr.sign(msg, key)
}

export function verify(sig, msgHash, pubKey) {
  return schnorr.verify(sig, msgHash, pubKey)
}

export function getRandomBytes(size = 32) {
  return crypto.getRandomValues(new Uint8Array(size))
}

export function getRandomString(size = 32) {
  return bytesToHex(getRandomBytes(size))
}

export async function importKey(string) {
  /** Derive a shared key-pair that is NIP-04 compliant and 
   *  import as a CryptoKey object (for Webcrypto library).
   */
  const secret  = await crypto.subtle.digest('SHA-256', ec.encode(string)),
        options = { name: 'AES-CBC' },
        usage   = [ 'encrypt', 'decrypt' ];
  return crypto.subtle.importKey('raw', new Uint8Array(secret), options, true, usage)
}

export async function encrypt(message, keyFile ) {
  /** Encrypt a message using a CryptoKey object,
   *  and format a NIP-04 compliant string output.
   */
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const cipherBytes = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv }, 
    keyFile,
    ec.encode(message)
  ).then((bytes) => new Uint8Array(bytes))
  const concatBytes = new Uint8Array([ ...iv, ...cipherBytes ])
  return btoa(bytesToHex(concatBytes))
}

export async function decrypt(encodedText, keyFile) {
  /** Decode an encrypted message using NIP-04 spec,
   *  and decrypt using a CryptoKey object.
   */
  const bytes = hexToBytes(atob(encodedText))
  const plainText = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: bytes.slice(0, 16) },
    keyFile,
    bytes.slice(16)
  )
  return dc.decode(plainText)
}

export function bytesToHex(byteArray) {
  for (var arr = [], i = 0; i < byteArray.length; i++) {
    arr.push(byteArray[i].toString(16).padStart(2, '0'))
  }
  return arr.join('')
}

export function hexToBytes(str) {
  for (var arr = [], i = 0; i < str.length; i += 2) {
    arr.push(parseInt(str.substr(i, 2), 16))
  }
  return Uint8Array.from(arr)
}
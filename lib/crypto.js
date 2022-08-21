const { schnorr } = nobleSecp256k1
const ec = new TextEncoder()
const dc = new TextDecoder()

export async function hash(string) {
  return crypto.subtle.digest('SHA-256', ec.encode(string))
    .then((bytes) => bytesToHex(bytes))
}

export async function genSignKeys(secret) {
  const privateKey = (secret)
    ? await hash(secret)
    : await hash(getRandomString())

  console.log(privateKey)
  return {
    private: privateKey,
    public: schnorr.getPublicKey(privateKey)
  }
}

export function sign(msg, key) {
  return secp.schnorr.sign(msg, key)
}

export function verify() {
  return secp.schnorr.verify()
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

  const privKey = await hash(string),
        options = { name: 'AES-CBC' },
        usage   = [ 'encrypt', 'decrypt' ];

  console.log(privKey)

  return crypto.subtle.importKey('raw', ec.encode(privKey), options, true, usage)
}

export async function encrypt(message, keyFile ) {
  /** Encrypt a message using a CryptoKey object,
   *  and format a NIP-04 compliant string output.
   */
  const iv = crypto.getRandomValues(new Uint8Array(16))

  const cipherText = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv }, 
    keyFile,
    ec.encode(message)
  ).then((bytes) => iv.concat(bytes))

  return btoa(bytesToHex(cipherText))
}

export async function decrypt(encodedText, keyFile) {
  /** Decode an encrypted message using NIP-04 spec,
   *  and decrypt using a CryptoKey object.
   */

  const bytes = hexToBytes(atob(encodedText))

  const plainText = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: bytes.slice(0.16) }, 
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
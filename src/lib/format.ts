import { Json } from '@/schema/types'

const crypto = globalThis.crypto

const ec = new TextEncoder()
const dc = new TextDecoder()

function bytesToHex (
  bytes : Uint8Array
) : string {
  const arr : string[] = []
  for (let i = 0; i < bytes.length; i++) {
    const hex = bytes[i]
      .toString(16)
      .padStart(2, '0')
    arr.push(hex)
  }
  return arr.join('')
}

function hexToBytes (
  hex : string
) : Uint8Array {
  const arr : number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    arr.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return Uint8Array.from(arr)
}

function normalizeHex (
  input : string | Uint8Array
) : Uint8Array {
  return (typeof input === 'string')
    ? hexToBytes(input)
    : input
}

function b64encode (
  bytes : Uint8Array
) : string {
  return (typeof window !== 'undefined')
    ? btoa(bytesToHex(bytes)).replace('+', '-').replace('/', '_')
    : Buffer.from(bytesToHex(bytes)).toString('base64url')
}

function b64decode (
  string : string
) : Uint8Array {
  return (typeof window !== 'undefined')
    ? hexToBytes(atob(string.replace('-', '+').replace('_', '/')))
    : hexToBytes(Buffer.from(string, 'base64url').toString('utf8'))
}

function isJSON(string : string) : boolean {
  try { JSON.parse(string); return true } catch { return false }
}

function revive<T = Json> (string : string) : T | string {
  try { return JSON.parse(string) } catch { return string }
}

export function getRandomBytes (size : number = 32) : Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size))
}

export const Hex = {
  encode    : bytesToHex,
  decode    : hexToBytes,
  normalize : normalizeHex,
  random    : (size ?: number) : string => bytesToHex(getRandomBytes(size))
}

export const Text = {
  isJSON,
  revive,
  encode : (str : string)     => ec.encode(str),
  decode : (raw : Uint8Array) => dc.decode(raw),
  random : (size ?: number) : string => b64encode(getRandomBytes(size))
}

export const Base64 = {
  encode : b64encode,
  decode : b64decode
}

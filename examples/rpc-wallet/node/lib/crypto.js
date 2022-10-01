import { webcrypto as crypto } from 'crypto'

export function getRandomHex(size=16) {
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  return Buffer.from(bytes).toString('hex')
}

export function getRandomBase64(size=16) {
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  return Buffer.from(bytes).toString('base64')
}
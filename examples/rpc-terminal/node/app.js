import NostrEmitter        from '@cmdcode/nostr-emitter'
import rpc                 from './lib/rpc.js'
import { getRandomBase64 } from './lib/crypto.js'

const relayUrl = 'nostr-relay.wlvs.space'
const secret   = getRandomBase64()

const connectString = Buffer.from(`${relayUrl}:${secret}`).toString('base64url')
const emitter = new NostrEmitter()

emitter.on('getinfo', async () => {
  console.log('Received getinfo event.')
  try {
    const balance = await rpc('getbalance'),
          blockct = await rpc('getblockcount')
    const { chain } = await rpc('getblockchaininfo')
    emitter.emit('nodeinfo', { balance, blockct, chain })
  } catch(err) { errorHandler(err) }
})

emitter.on('call', async data => {
  console.log('Received request:', data)
  try {
    const [ method, ...params ] = data
    const result = await rpc(method, params)
    emitter.emit('response', result)
  } catch (err) { errorHandler(err) }
})

function errorHandler(err) {
  console.error(err)
  emitter.emit('error', err.toString())
}

await emitter.connect('wss://' + relayUrl, secret)

console.log(`Paste this connection string into your web app:\n\n${connectString}\n`)

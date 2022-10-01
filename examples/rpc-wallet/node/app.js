import rpc from './lib/rpc.js'
import NostrEmitter from '../../../index.js'
import { getRandomBase64 } from './lib/crypto.js'

const relayUrl = 'nostr-relay.wlvs.space'
const secret   = getRandomBase64()

console.log(secret)

const connectString = Buffer.from(`${relayUrl}:${secret}`).toString('base64url')
const emitter = new NostrEmitter()

emitter.on('getinfo', async () => {
  const balance = await rpc('getbalance'),
        blockct = await rpc('getblockcount')
  const { chain } = await rpc('getblockchaininfo')
  emitter.emit('nodeinfo', { 
    alias: 'bitcoin', balance, blockct, chain 
  })
})

emitter.on('call', async data => {
  const [ method, ...params ] = data
  console.log(method, params)
  let response = await rpc(method, params)
  emitter.emit('response', response)
})

await emitter.connect('wss://' + relayUrl, secret)

console.log(`Paste this connection string into your web app:\n\n${connectString}\n`)

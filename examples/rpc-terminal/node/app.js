const { webcrypto: crypto } = require('crypto')

const NostrEmitter = require('../../../index')
const rpc = require('./lib/rpc')

const relayUrl = 'wss://nostr-relay.wlvs.space'

const random = crypto.getRandomValues(new Uint8Array(16))
const secret = Buffer.from(random).toString('hex')
const connectString = Buffer.from(`${relayUrl}&${secret}`).toString('base64')

const emitter = new NostrEmitter(relayUrl, secret)

emitter.connect()
.then(() => {
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
    let response = await rpc(method, params)
    emitter.emit('response', response)
  })
})

console.log(`Paste this connection string into your web app:\n\n${connectString}\n`)

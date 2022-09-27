//const NostrEmitter = require('./lib/nostr-emitter')
const NostrEmitter = require('nostr-emitter')
const rpc = require('./lib/rpc')

const emitter = new NostrEmitter(
  'wss://nostr-relay.wlvs.space',
  'bitcoin:password'
)

emitter.connect()
.then(() => {
  emitter.on('call', async data => {
    const [ method, ...params ] = data
    let response = await rpc(method, params)
    emitter.emit('response', response)
  })
})


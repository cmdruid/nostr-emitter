const NostrEmitter = require('../../index')
//const NostrEmitter = require('nostr-emitter')
const rpc = require('./lib/rpc')

const emitter = new NostrEmitter(
  'wss://nostr-relay.wlvs.space',
  'bitcoin:password'
)

emitter.connect()
.then(() => {
  console.log(emitter.keys)
  emitter.on('call', async data => {
    const [ method, ...params ] = data
    let response = await rpc(method, params)
    console.log(response)
    emitter.emit('response', response)
  })
})


import NostrEmitter from '../../index.js'

const relayUrl = 'nostr-relay.wlvs.space'
const secret   = 'supersecretstring'

const emitter = new NostrEmitter()

emitter.on('ping', data => {
  console.log('Received:', data)
  emitter.emit('pong', 'pong!')
})

emitter.on('pong', data => {
  console.log('Received:', data)
})

await emitter.connect('wss://' + relayUrl, secret)

setInterval(() => emitter.emit('ping', 'ping!'), 5000)

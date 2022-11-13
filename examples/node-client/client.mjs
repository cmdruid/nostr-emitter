/* Basic connection between two nodes. 
 * Start command in terminal:
 *   SECRET_KEY=<your key> node client.mjs
 */

import NostrEmitter from '../../index.js'

const relayUrl = 'nostr-relay.wlvs.space'
const secret   = process.env.SECRET_KEY

const emitter = new NostrEmitter()

emitter.on('ping', data => {
  console.log('Received:', data)
  emitter.emit('pong', 'pong!')
})

emitter.on('pong', data => {
  console.log('Received:', data)
})

await emitter.connect('wss://' + relayUrl, secret)

setInterval(() => {
  console.log('Sending ping ...')
  emitter.emit('ping', 'ping!')
}, 5000)

/* Basic connection between two nodes. 
 * Start command in terminal:
 *   SECRET_KEY=<your key> node client.mjs
 */

import { NostrClient, KeyPair } from '@cmdcode/nostr-emitter'

const { prvkey } = KeyPair.random()
const client = new NostrClient(prvkey, { selfsub : true })

client.on('ready', emitter => {

  console.log('Connected to ' + emitter.client.address)

  emitter.on('ping', data => {
    console.log('Received:', data)
  })
})

const address = 'wss://relay-pub.deschooling.us'
const secret  = process.env.SECRET_KEY
const emitter = await client.connect(address, secret)

setInterval(() => {
  console.log('Sending ping ...')
  emitter.relay('ping', 'ping!')
}, 5000)

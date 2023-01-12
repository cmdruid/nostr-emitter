// Import the client and Keypair utility.
import { NostrClient, KeyPair } from '../src/index.js'

// Create a random keypair, or use a secret phrase.
const { prvkey, pubkey } = KeyPair.random()
// const { prvkey, pubkey } = KeyPair.fromSecret('hunter2')

// Optional: Self-published events are filtered
// out by default, but let's enable them for testing.
const config = { selfsub: true }

// Now we can create a type-safe client emitter.
const client = new NostrClient(prvkey, config)

client.on('ready', (client) => {
  // The ready event is emitted by the client once
  // it is connected to a relay.
  console.log('Connected to ' + client.address)
})

const sub = client.subscribe()

sub.on('ready', () => {
  console.log('Subscribed with ' + sub.id)
  sub.relay({ content: 'This is a test!' })
})

sub.on('event', (event) => {
  console.log(event)
})

// The address of the relay.
const address = 'wss://relay-pub.deschooling.us'
// Optional: You can provide a secret for encrypting messages!
// const secret  = 'thisisatestpleaseignore'
// The connect method returns an emitter object for our events.

await client.connect(address)

// Import the client and Keypair utility.
import { NostrClient, KeyPair } from '../src/index.js'

// Create a random keypair, or use a secret phrase.
const { prvkey, pubkey } = KeyPair.random()
// const { prvkey, pubkey } = KeyPair.fromSecret('hunter2')

// Optional: We can define a type for our event!
type Greeting = { name : string, location  : string }

// Optional: Self-published events are filtered
// out by default, but let's enable them for testing.
const config = { selfsub: true }

// Now we can create a type-safe client emitter.
const client = new NostrClient<Greeting>(prvkey, config)

client.on('ready', (emitter) => {
  // The ready event is emitted by the client once
  // it is connected and subscribed to a relay.

  console.log('Connected to ' + emitter.client.address)

  // Example of how to broadcast an event.
  emitter.relay('helloEvent', { name: 'Bob', location: 'Panama' })
})

// The address of the relay.
const address = 'wss://relay-pub.deschooling.us'
// Optional: You can provide a secret for encrypting messages!
// const secret  = 'thisisatestpleaseignore'
// The connect method returns an emitter object for our events.
const emitter = await client.connect(address)

// Register an event listener.
emitter.on('helloEvent', (data, event) => {
  console.log(`Hello from ${data.name} in ${data.location}!`)
  console.log(`Sent from pubkey: ${event.pubkey}`)
  console.log(`Event Payload:`, JSON.stringify(event, null, 2))
})

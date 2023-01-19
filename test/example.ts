// Import the client and (optional) Keypair utility.
import { NostrClient } from '../src/index'

// Creating a new client is very simple.
const client = new NostrClient({ selfsub: true })

// Change the private key of the client at any time.
client.prvkey = '168b760cee3ce1c768d39bf133bf5a9e030f47670b6fbf9211a8bb278f4b4f69'

client.on('ready', (client) => {
  // The ready event is emitted by a client 
  // once it has connected to a relay.
  console.log('Connected to ' + client.address)
  // It is easy to relay a message to the world.
  client.relay({ content: 'Hello, world!' })
})

// Creating a new subscription is easy.
const sub = client.subscribe({ 
  kinds: [ 29001 ], 
  since: Math.floor(Date.now() / 1000)
})

sub.on('ready', (sub) => {
  // Subscriptions also have a 'ready' event 
  // for handing the flow of your application.
  console.log('Subscribed with filter:', sub.filter)
  // We can also easily cancel a subscription.
  setTimeout(() => sub.cancel(), 2000)
})

sub.on('event', (event) => {
  // Subscriptions are simple emitter objects 
  // that will emit 'event' and 'eose' topics.
  console.log(event)
})

// You can create an event 'channel' by specifying a topic,
// with options to configure encryption and custom filters.
const topic = client.topic('secretchat', { encrypt: true })

topic.on('ready', (emitter) => {
  // Topics also have a 'ready' event for
  // handing the flow of your application.
  console.log('Subscribed with ' + emitter.sub.id)
  // 
  emitter.relay('hello', { content: 'This is a test!' })
})

topic.on('hello', (content) => {
  // Topics provide their own internal event bus,
  // so anyone can publish and subscribe to your
  // custom events within the topic channel.
  console.log('hello', content)
})

topic.on('ALL', (_content, event) => {
  // All emitters have an 'ALL' event, which will
  // subscribe you to all events on that emitter.

  // If encryption is en, (_content, event)abled, the contents of the
  // topic channel will be group end-to-end encrypted.
  console.log('Encrypted content:', event.content)
})

// The address of the relay.
const address = 'wss://nostr.zebedee.cloud'

// client.on('info', console.log)
// client.on('error', console.log)
await client.connect(address)

client.close()

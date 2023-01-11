# nostr-emitter
An end-to-end group encrypted event emitter, built on the Nostr protocol.

Features:
 - Create encrypted channels between clients using a shared secret.
 - Send packets of data to everyone using simple pub/sub events.
 - Customize and broadcast any kind of event. Create your own protocol.
 - Specify a type and get type-checking on all emitted events.
 - Runs in node and the browser with very minimal dependencies (2).
 - Coming soon: Middleware and run-time schema validation (via zod).

## Installation
This package is designed to work in both the browser and nodejs.

```html
<!-- Browser import -->
<script src="https://unpkg.com/@cmdcode/nostr-emitter"></script>
<script type="module"> 
  const { NostrClient } = window.nostrEmitter
</script>
```
```js
// Commonjs import.
const { NostrClient } = require('@cmdcode/nostr-emitter')
// ES6 import.
import { NostrClient } from '@cmdcode/nostr-emitter'
```

## How to Use
To get started, we will first configure a client.

```ts
// Import the client and Keypair utility.
import { NostrClient, KeyPair } from '../src/index.js'

// Example of importing a keypair from a simple passphrase. 
// There are many key import options available.
const { prvkey, pubkey } = KeyPair.fromSecret('hunter2')

// Optional: We can define a type for our event!
type Greeting = { name : string, location  : string }

// Optional: Self-published events are filtered out 
// by default. Let's enable them for demonstration.
const config = { selfsub: true }

// Now we can create a type-safe nostr client.
const client = new NostrClient<Greeting>(prvkey, config)

client.on('ready', (emitter) => {
  // The ready event is emitted by the client once
  // it is connected and subscribed to a relay.

  console.log('Connected to ' + emitter.client.address)

  // The ready event will also pass down an emitter object
  // to use for broadcasting and listening to subscribed events.

  // Example of listening for an event.
  emitter.on('helloEvent', (data, event) => {
    console.log(`Hello from ${data.name} in ${data.location}!`)
    console.log(`Sent from pubkey: ${event.pubkey}`)
  })
})
```

Once we have the client configured, it's easy to connect and subscribe to a relay.

```ts
// The address of the relay.
const address = 'wss://relay-pub.deschooling.us'

// Optional: You can provide a shared secret used to establish 
// an encrypted channel. If none is specified, then the relay 
// address is used as a default unencrypted channel.
const secret = 'thisisatestpleaseignore'

// The connect method also returns an emitter object for our events.
const emitter = await client.connect(address, secret)

// Example of relaying an event to other clients.
emitter.relay('helloEvent', { name: 'Bob', location: 'Panama' })
```

The client is also configurable with a few options.

```ts
// Specify default parameters for events.
export interface Config {
  kind    ?: number
  tags    ?: string[][]
  filter  ?: Filter
  selfsub ?: boolean
}
```


## How it works

The client works as typical nostr client. You can send messages to relays, and subscribe to message filters. When a type is provided to the client, the `content` field on event messages will be checked by typescript, and the event bus will also be type-guarded.

When a shared secret is provided for encryption, a hash of the secret is used to generate the encryption key. The contents of each event are end-to-end encrypted using AES, and the event message is tagged with a hash of the encryption key. This hashtag is added to the subscription, so that each emitter will only see events tagged with the proper hash. Consider it an easy way to setup encrypted channels between emitters!

Everything else works like a basic event emitter API. Methods include 'on', 'once', 'emit' (local), 'relay' (broadcast) and 'remove'.

Some helpful tips:
* For public channels, the shared secret can be something obvious, like 'general-chat'.
* For organizing channel hierarchies, try using paths in the shared secret i.e 'secret/topic/subtopic'.
* You can customize the default tags and filter used by the client for publishing / subscribing.
* When sendind a message, you can provide a custom template that overrides the defaults.
* You can use the 'any' event name to listen to all events.
* The client emits log messages under 'info', 'debug', and 'error'.


## Resources

**Noble-secp256k1 Library**  
Used for identity and signing events.  
https://github.com/paulmillr/noble-secp256k1

**Websockets** (nodejs only)  
Used for communicating over a websocket.  
https://github.com/websockets/ws

**Nostr Implementation Possibilities**  
https://github.com/nostr-protocol/nips

**Nostr-tools**  
https://github.com/fiatjaf/nostr-tools

## Contributions
All contributions are welcome!

## Special Thanks
Special thanks to supertestnet for his help and guidance.  
https://github.com/supertestnet

# nostr-emitter
A server-less, peer-to-peer event emitter. Built on Nostr.

## How to use
Specify the relay server to use, along with a shared secret.

```
// Declare a new event emitter object.
const emitter = new NostrEmitter(
  'wss://nostr-relay.wlvs.space',
  'secret-string'
)

// Connect your emitter to the relay.
await emitter.connect()

// Register an event listener.
emitter.on('some-event', eventData => {
  console.log('Hello ', eventData)
})

// Publish events like any other emitter.
emitter.emit('some-event', 'world!')

// Self-published events are filtered out 
// by default, but you can enable them.
emitter.opt.selfPub = true

// Specify optional parameters.
const emitter = new NostrEmitter(relayUrl, secret, {
  version : 0,         // Nostr protocol version.
  kind    : 29001,     // Default event type (ephemeral).
  selfPub : false,     // Filter self-published events.
  socket  : WebSocket  // Specify your own websocket object.
  tags    : []         // Add your own tags to each message.
  filter  : {}         // Add your own subscription filters.
})
```

## How it works
The contents of each message is end-to-end encrypted using a hash of the shared secret, then tagged with a double-hash of the secret. 

Messages are filtered by this hash-tag, so your emitters will only see ones that are tagged with the proper hash. Older messages are also filtered out.

Everything else works like a basic event emitter API: 'on', 'once', 'emit' and 'remove'.

## Tips
* The shared secret can be something simple that anyone can guess, like 'general-chat'.

* For organizing channels, try concatenating your secrets:
  'topic/subtopic/password' etc.

* You can change the default emitter.filter before calling emitter.connect().

## Resources
**Nostr Implementation Possibilities**  
https://github.com/nostr-protocol/nips

**Noble-secp256k1 Library**  
https://github.com/paulmillr/noble-secp256k1

**Nostr-tools**  
https://github.com/fiatjaf/nostr-tools

# nostr-emitter
A basic peer-to-peer event emitter, built on the Nostr protocol.


## Installation
This package is designed to work in both the browser and nodejs.

```html
<!-- Browser import -->
<script src='https://bundle.run/noble-secp256k1@1.2.14'></script>
<script src="https://unpkg.com/@cmdcode/nostr-emitter"></script>
```
```js
// Commonjs import.
const NostrEmitter = require('@cmdcode/nostr-emitter')

// ES6 import.
import NostrEmitter from '@cmdcode/nostr-emitter'
```

## How to use
To get started, simply provide a relay server and shared secret to use, then run `emitter.connect()`.

Once connected, the emitter behaves like a typical EventEmitter object.
```js
// Declare a new event emitter object.
const emitter = new NostrEmitter()

// Connect your emitter to the relay.
await emitter.connect(
  'wss://nostr.zebedee.cloud',
  'secret-string'
)

// Register an event listener.
emitter.on('some-event', eventData => {
  console.log('Hello ', eventData)
})

// Publish events like any other emitter.
emitter.emit('some-event', 'world!')

// Self-published events are filtered out 
// by default, but you can enable them.
emitter.opt.selfsub = true

// Specify optional parameters.
const emitter = new NostrEmitter({
  version : 0,          // Nostr protocol version.
  kind    : 29001,      // Default event type (ephemeral).
  selfPub : false,      // Filter self-published events.
  socket  : WebSocket,  // Specify your own websocket object.
  tags    : [],         // Add your own tags to each message.
  filter  : {}          // Add your own subscription filters.
})
```


## How it works
The contents of each event is end-to-end encrypted using a hash of the shared secret, then the event itself is tagged with a double-hash of the secret. 

Events are filtered by this hash-tag, so each emitter will only see events tagged with the proper hash. Old events are also filtered out by default.

Everything else works like a basic event emitter API. Methods include 'on', 'once', 'emit' and 'remove'.

Some helpful tips:
* For public channels, the shared secret can be something obvious, like 'general-chat'.
* For organizing groups or channels, try using paths as a secret string: 'secret/topic/subtopic'
* You can change the default emitter.filter before calling emitter.connect().
* The main index.js file is less than 400 lines of code. Feel free to change it as you wish!


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

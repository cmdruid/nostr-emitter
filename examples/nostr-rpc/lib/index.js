// Detect if we are running in the browser.
const isBrowser = (typeof window !== 'undefined')

// Import our required packages.
const { schnorr } = (isBrowser)
  ? window.nobleSecp256k1
  : require('@noble/secp256k1')
const WebSocket = (isBrowser)
  ? window.WebSocket 
  : require('ws')
const crypto = (isBrowser)
  ? window.crypto
  : require('crypto').webcrypto

// Specify our base64 helper functions.
const b64encode = (isBrowser)
  ? (bytes) => btoa(bytesToHex(bytes))
  : (bytes) => Buffer.from(bytesToHex(bytes)).toString('base64')
const b64decode = (isBrowser)
  ? (str) => hexToBytes(atob(str))
  : (str) => hexToBytes(Buffer.from(str, 'base64').toString('utf8'))

// Specify our text encoders.
const ec = new TextEncoder()
const dc = new TextDecoder()

// Helper functions for encoding / decoding JSON.
const JSONencode = data => JSON.stringify(data)
const JSONdecode = data => JSON.parse(data)

// Default options to use.
const DEFAULT_OPT = {
  version : 0,      // Protocol version.
  kind    : 29001,  // Default event type.
  tags    : [],     // Global tags for events.
  selfPub : false   // React to self-published events.
}

// Default filter rules to use.
const DEFAULT_FILTER = {
  'since': Math.floor(Date.now() / 1000)
}

class NostrEmitter {
  constructor(relayUrl, secret, opt={}) {

    if (!relayUrl) {
      throw new Error('Must provide url to a relay!')
    }

    if (!secret) {
      throw new Error('Must provide a shared secret!')
    }

    this.connected  = false
    this.subscribed = false

    this.keys = { 
      priv   : null,
      pub    : null,
      shared : null,
      digest : null
    }

    this.events = []
    this.tags   = []
    this.url    = relayUrl
    this.secret = secret
    this.subId  = null
    this.opt    = { ...DEFAULT_OPT, ...opt }
    this.socket = opt?.socket || new WebSocket(this.url)

    this.filter = {
      'kinds': [ this.opt.kind ],
      ...DEFAULT_FILTER,
      ...opt.filter,
    }

    if (isBrowser) {
      // Compatibility fix between node and browser.
      this.socket.on = this.socket.addEventListener
    }

    this.socket.on('open', (_) => {
      console.log('Socket connected to: ', this.url)
      this.connected = true
      this.subscribe()
    })

    this.socket.on('message', async (event) => {
      // Decode message based upon the data type.
      
      const [ type, subId, data ] = this.decodeEvent(event)

      // Check if event is a response to a subscription.
      if (type === 'EOSE') {
        this.subId = subId
        this.subscribed = true
        console.log('Subscription Id:', this.subId)
      }

      // If the event has no data, return.
      if (!data) return

      // Unpack our data object.
      const { content, ...meta } = data
    
      // If the event is from ourselves, filter it.
      if (meta?.pubkey === this.keys.pub && !this.opt.selfPub) {
        return
      }
      
      // Decrypt the content.
      const { eventName, eventData } = await this.decryptContent(content)

      this._getEventListByName(eventName).forEach(function(fn) {
        fn.apply(this, [ ...eventData, meta ])
      }.bind(this))
    })

    return this
  }

  async connect() {
    // We need to generate a new key-pair for signing messages.
    const keys = await genSignKeys()
  
    this.keys = { 
      priv   : keys[0],
      pub    : keys[1],
      shared : await importKey(this.secret),
      label  : await new hash(this.secret, 2).hex()
    }

    this.tags.push(["s", this.keys.label])
    this.filter['#s'] = [ this.keys.label ]

    return new Promise((res, rej) => {
      let count = 0, retries = 10
      let interval = setInterval(() => {
        if (this.connected && this.subscribed) {
          console.log('Connected and subscribed!')
          res(clearInterval(interval))
        } else if (count > retries) { 
          console.log('Failed to connect!')
          rej(clearInterval(interval))
        } else {
          count++
        }
      }, 500)
    })
  }

  async subscribe() {
    /** Send a subscription message to the socket peer.
     */
    const subId = getRandomString()
    const subscription = [ "REQ", subId, this.filter ]
    this.socket.send(JSONencode(subscription))
  }

  decodeEvent(event) {
    // Decode an incoming event.
    return (event instanceof Uint8Array)
        ? JSONdecode(event.toString('utf8'))
        : JSONdecode(event.data)
  }

  async decryptContent(content) {
    return decrypt(content, this.keys.shared)
      .then((data) => JSONdecode(data))
      .catch((err) => console.error(err))
  }

  async send(eventName, eventData) {
    /** Send a data message to the socket peer.  
     */
    const serialData = JSONencode({ eventName, eventData })
    const event = {
      "content"    : await encrypt(serialData, this.keys.shared),
      "created_at" : Math.floor(Date.now() / 1000),
      "kind"       : this.opt.kind,
      "tags"       : [...this.tags, ...this.opt.tags ],
      "pubkey"     : this.keys.pub
    }
    
    // Sign our message.
    const signedEvent = await this.getSignedEvent(event)
    
    // Serialize and send our message.
    this.socket.send(JSONencode([ "EVENT", signedEvent ]))
  }

  async getSignedEvent(event) {
    /** Produce a signed hash of our event, attach it
     *  to the event object, then serialize the result.
     */
    const eventData = JSONencode([
      0,		                // Reserved for future use.
      event['pubkey'],	    // The sender's public key
      event['created_at'],  // Unix timestamp.
      event['kind'],		    // Message “kind” or type.
      event['tags'],		    // Tags – identify replies or recipients.
      event['content']      // Your note contents.
    ])
    
    // Append event ID and signature
    event.id  = await new hash(eventData).hex()
    event.sig = await sign(event.id, this.keys.priv)

    // Verify that the signature is valid.
    if (!verify(event.sig, event.id, event.pubkey)) {
      throw 'event signature failed verification!'
    }

    // If the signature is returned in bytes, convert to hex.
    if (event.sig instanceof Uint8Array) {
      event.sig = bytesToHex(event.sig)
    }
    
    return event
  }

  _getEventListByName(eventName) {
    /** If key undefined, create a new set for the event, 
     * else return the stored subscriber list.
     * */
    if (typeof this.events[eventName] === 'undefined') {
      this.events[eventName] = new Set()
    }
    return this.events[eventName]
  }

  on(eventName, fn) {
    /** Subscribe function to run on a given event. */
    this._getEventListByName(eventName).add(fn)
  }

  once(eventName, fn) {
    /** Subscribe function to run once, using
     * a callback to cancel the subscription.
     * */
    const self = this

    const onceFn = function(...args) {
      self.removeListener(eventName, onceFn)
      fn.apply(self, args)
    };

    this.on(eventName, onceFn)
  }

  emit(eventName, ...args) {
    /** Emit a series of arguments for the event, and
     * present them to each subscriber in the list.
     * */
    this.send(eventName, args)
  }
  
  remove(eventName, fn) {
    /** Remove function from an event's subscribtion list. */
    this._getEventListByName(eventName).delete(fn)
  }
}

// Crypto library.

async function sha256(raw) {
  return crypto.subtle.digest('SHA-256', raw)
}

class hash {
  /** Digest a message with sha256, using x number of rounds.
   */
  constructor(str, rounds) {
    this.raw  = ec.encode(str)
    this.num  = rounds || 1
  }
  async digest() {
    for (let i = 0; i < this.num; i++) {
      this.raw = await sha256(this.raw)
    }
    return this.raw
  }
  async hex() {
    return this.digest()
      .then((hash) => bytesToHex(new Uint8Array(hash)))
  }
  async bytes() {
    return this.digest()
      .then((hash) => new Uint8Array(hash))
  }
}

async function genSignKeys(secret) {
  /** Generate a pair of schnorr keys for 
   *  signing our Nostr messages.
   */
  const privateKey = (secret)
    ? await new hash(secret).bytes()
    : getRandomBytes(32)
  const publicKey = schnorr.getPublicKey(privateKey)
  return [
    bytesToHex(new Uint8Array(privateKey)),
    bytesToHex(new Uint8Array(publicKey))
  ]
}

async function importKey(string) {
  /** Derive a shared key-pair and import as a 
   * CryptoKey object (for Webcrypto library).
   */
  const secret  = await new hash(string).bytes(),
        options = { name: 'AES-CBC' },
        usage   = [ 'encrypt', 'decrypt' ];
  return crypto.subtle.importKey('raw', secret, options, true, usage)
}

async function encrypt(message, keyFile ) {
  /** Encrypt a message using a CryptoKey object.
   */
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const cipherBytes = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv }, 
    keyFile,
    ec.encode(message)
  ).then((bytes) => new Uint8Array(bytes))
  // Return a concatenated and base64 encoded array.
  return b64encode(new Uint8Array([ ...iv, ...cipherBytes ]))
}

async function decrypt(encodedText, keyFile) {
  /** Decrypt an encrypted message using a CryptoKey object.
   */
  const bytes = b64decode(encodedText)
  const plainText = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: bytes.slice(0, 16) },
    keyFile,
    bytes.slice(16)
  )
  return dc.decode(plainText)
}

function bytesToHex(byteArray) {
  for (var arr = [], i = 0; i < byteArray.length; i++) {
    arr.push(byteArray[i].toString(16).padStart(2, '0'))
  }
  return arr.join('')
}

function hexToBytes(str) {
  for (var arr = [], i = 0; i < str.length; i += 2) {
    arr.push(parseInt(str.substr(i, 2), 16))
  }
  return Uint8Array.from(arr)
}

function sign(msg, key) {
  return schnorr.sign(msg, key)
}

function verify(sig, msgHash, pubKey) {
  return schnorr.verify(sig, msgHash, pubKey)
}

function getRandomBytes(size = 32) {
  return crypto.getRandomValues(new Uint8Array(size))
}

function getRandomString(size = 32) {
  return bytesToHex(getRandomBytes(size))
}

if (isBrowser) {
  window.NostrEmitter = NostrEmitter
} else {
  module.exports = NostrEmitter
}
// Detect if we are running in the browser.
const isBrowser = typeof window !== 'undefined'

// Import our required packages.
const { schnorr } = isBrowser
  ? window.nobleSecp256k1
  : require('@noble/secp256k1')

const WebSocket = isBrowser ? window.WebSocket : require('ws');
const crypto = isBrowser ? window.crypto : require('crypto').webcrypto;

// Specify our base64 helper functions.
const b64encode = isBrowser
  ? (bytes) => btoa(bytesToHex(bytes))
  : (bytes) => Buffer.from(bytesToHex(bytes)).toString('base64')
const b64decode = isBrowser
  ? (str) => hexToBytes(atob(str))
  : (str) => hexToBytes(Buffer.from(str, 'base64').toString('utf8'))

// Specify our text encoders.
const ec = new TextEncoder();
const dc = new TextDecoder();

// Helper functions for encoding / decoding JSON.
const JSONencode = (data) => JSON.stringify(data);
const JSONdecode = (data) => JSON.parse(data);

// Default options to use.
const DEFAULT_OPT = {
  version: 0,      // Protocol version.
  kind: 29001,     // Default event type.
  tags: [],        // Global tags for events.
  selfPub: false,  // React to self-published events.
  verbose: false,  // Show verbose log output.
  since: Math.floor(Date.now() / 1000)
};

class NostrEmitter {
  // Our main class object.

  static globals = { isBrowser: typeof window !== 'undefined' }

  static utils = {}

  constructor(opt = {}) {
    this.connected = false;
    this.subscribed = false;

    this.keys = {
      priv: null,
      pub: null,
      shared: null,
      digest: null,
    };

    this.events = { all: new Set() }
    this.tags = []
    this.relayUrl = null
    this.secret = null
    this.signSecret = null
    this.id = getRandomString(16)
    this.subId = null
    this.opt = { ...DEFAULT_OPT, ...opt }
    this.socket = opt.socket || null
    this.log = (...s) => (opt.log) ? opt.log(...s) : console.log(...s)

    this.filter = {
      kinds: [this.opt.kind],
      ...opt.filter,
    };

    if (this.opt.since) this.filter.since = this.opt.since
  }

  async subscribe() {
    /** Send a subscription message to the socket peer.
     * */

    // Define the subscription id as a hash of our unique
    // id, plus the serialized JSON of our filters.
    const subId = await new hash(this.id + JSONencode(this.filter)).hex()
    
    // Send our subscription request to the relay.
    const subscription = ['REQ', subId, this.filter]
    this.socket.send(JSONencode(subscription))
  }

  async connect(relayUrl, secret) {
    /** Configure our emitter for connecting to
     *  the relay network.
     * */

    // If provided, update the current config.
    this.relayUrl = relayUrl || this.relayUrl
    this.secret = secret || this.secret

    if (!this.relayUrl) {
      throw new Error('Must provide url to a relay!')
    }

    if (!this.secret) {
      throw new Error('Must provide a shared secret!')
    }

    this.relayUrl = (this.relayUrl.includes('wss://'))
      ? this.relayUrl
      : 'wss://' + this.relayUrl

    this.socket = new WebSocket(this.relayUrl)

    if (isBrowser) {
      // Compatibility fix between node and browser.
      this.socket.on = this.socket.addEventListener
    }

    // Setup our main socket event listeners.
    this.socket.on('open', (event) => this.openHandler(event))
    this.socket.on('message', (event) => this.messageHandler(event))

    // Generate a new pair of signing keys.
    const keys = await getSignKeys(this.signSecret);

    this.keys = {
      priv: keys[0],  // Private key.
      pub: keys[1],   // Public key.
      shared: await getSharedKey(this.secret),
      label: await new hash(this.secret, 2).hex(),
    };
    
    // Configure our event tags and filter.
    this.tags.push(['s', this.keys.label]);
    this.filter['#s'] = [this.keys.label];

    // Return a promise that includes a timeout.
    return new Promise((res, rej) => {
      let count = 0,
        retries = 10;
      let interval = setInterval(() => {
        if (this.connected && this.subscribed) {
          this.log('Connected and subscribed!');
          res(clearInterval(interval));
        } else if (count > retries) {
          this.log('Failed to connect!');
          rej(clearInterval(interval));
        } else {
          count++;
        }
      }, 500);
    });
  }

  decodeEvent(event) {
    // Decode an incoming event.
    return event instanceof Uint8Array
      ? JSONdecode(event.toString('utf8'))
      : JSONdecode(event.data);
  }

  async decryptContent(content) {
    // Decrypt content of a message.
    return decrypt(content, this.keys.shared)
      .then((data) => JSONdecode(data))
      .catch((err) => console.error(err));
  }

  async openHandler(event) {
    /** Handle the socket open event. */
    this.log('Socket connected to: ', this.relayUrl);
    this.connected = true;
    this.subscribe();
  }

  messageHandler(event) {
    /** Handle the socket message event. */
    const [type, subId, data] = this.decodeEvent(event)

    if (this.opt.verbose) {
      this.log('messageEvent: ' + JSON.stringify([type, subId, data], null, 2))
    }

    // Check if event is a response to a subscription.
    if (type === 'EOSE') {
      if (subId !== this.subId) {
        this.subId = subId
        this.subscribed = true
        this.log('Subscription Id:', this.subId)
      }
    }

    return (data) 
      ? this.eventHandler(data)
      : null
  }

  async eventHandler(data) {
    const { content, ...metaData } = data;

    // If the event is from ourselves, 
    if (metaData?.pubkey === this.keys.pub) {
      // check the filter rules. 
      if (!this.opt.selfPub) return
    }

    // Decrypt the message content.
    const { eventName, eventData } = await this.decryptContent(content);

    if (this.opt.verbose) {
      this.log(eventName + ' event: ' + JSON.stringify(eventData, null, 2))
      this.log('metaData: ' + JSON.stringify(metaData, null, 2))
    }

    // Apply the event to our emitter.
    const allEvents = [
      ...this._getEventListByName(eventName),
      ...this._getEventListByName('all')
    ]

    allEvents.forEach(
      function (fn) {
        const args = [ eventData, { eventName, ...metaData }]
        fn.apply(this, args)
      }.bind(this)
    )
  }

  async send(eventName, eventData, eventMsg = { tags: [] }) {
    /** Send a data message to the relay. */
    const serialData = JSONencode({ eventName, eventData });
    const event = {
      content    : await encrypt(serialData, this.keys.shared),
      created_at : Math.floor(Date.now() / 1000),
      kind       : eventMsg.kind || this.opt.kind,
      tags       : [...this.tags, ...this.opt.tags, ...eventMsg.tags],
      pubkey     : this.keys.pub
    }

    if (this.opt.verbose) {
      this.log('sendEvent: ' + JSON.stringify(event, null, 2))
    }

    // Sign our message.
    const signedEvent = await this.getSignedEvent(event);

    // Serialize and send our message.
    this.socket.send(JSONencode(['EVENT', signedEvent]));
  }

  async getSignedEvent(event) {
    /** Produce a signed hash of our event, 
     *  then attach it to the event object.
     * */
    const eventData = JSONencode([
      0,
      event['pubkey'],
      event['created_at'],
      event['kind'],
      event['tags'],
      event['content'],
    ]);

    // Append event ID and signature
    event.id = await new hash(eventData).hex();
    event.sig = await sign(event.id, this.keys.priv);

    // Verify that the signature is valid.
    if (!verify(event.sig, event.id, event.pubkey)) {
      throw 'event signature failed verification!';
    }

    // If the signature is returned in bytes, convert to hex.
    if (event.sig instanceof Uint8Array) {
      event.sig = bytesToHex(event.sig);
    }

    return event;
  }

  _getEventListByName(eventName) {
    /** If key undefined, create a new set for the event,
     *  else return the stored subscriber list.
     * */
    if (typeof this.events[eventName] === 'undefined') {
      this.events[eventName] = new Set();
    }
    return this.events[eventName]
  }

  on(eventName, fn) {
    /** Subscribe function to run on a given event. */
    this._getEventListByName(eventName).add(fn);
  }

  once(eventName, fn) {
    /** Subscribe function to run once, using
     *  a callback to cancel the subscription.
     * */
    const self = this;

    const onceFn = function (...args) {
      self.remove(eventName, onceFn);
      fn.apply(self, args);
    };

    this.on(eventName, onceFn);
  }

  within(eventName, fn, timeout) {
    /** Subscribe function to run within a given,
     *  amount of time, then cancel the subscription.
     * */
    setTimeout(() => this.remove(eventName, fn), timeout)
    this.on(eventName, fn)
  }

  emit(eventName, args, eventMsg) {
    /** Emit a series of arguments for the event, and
     *  present them to each subscriber in the list.
     * */
    this.send(eventName, args, eventMsg);
  }

  remove(eventName, fn) {
    /** Remove function from an event's subscribtion list. */
    this._getEventListByName(eventName).delete(fn);
  }
}

/** Crypto library. */

async function sha256(raw) {
  return crypto.subtle.digest('SHA-256', raw);
}

class hash {
  /** Digest a message with sha256, using x number of rounds. */
  constructor(str, rounds) {
    this.raw = ec.encode(str);
    this.num = rounds || 1;
  }
  async digest() {
    for (let i = 0; i < this.num; i++) {
      this.raw = await sha256(this.raw);
    }
    return this.raw;
  }
  async hex() {
    return this.digest().then((hash) => bytesToHex(new Uint8Array(hash)));
  }
  async bytes() {
    return this.digest().then((hash) => new Uint8Array(hash));
  }
}

async function getSignKeys(secret) {
  /** Generate a pair of schnorr keys for
   *  signing our Nostr messages.
   */
  const privateKey = secret
    ? await new hash(secret).bytes()
    : getRandomBytes(32);
  const publicKey = schnorr.getPublicKey(privateKey);
  return [
    bytesToHex(new Uint8Array(privateKey)),
    bytesToHex(new Uint8Array(publicKey)),
  ];
}

async function getSharedKey(string) {
  /** Derive a shared key-pair and import as a
   *  CryptoKey object (for Webcrypto library).
   */
  const secret = await new hash(string).bytes(),
    options = { name: 'AES-CBC' },
    usage = ['encrypt', 'decrypt'];
  return crypto.subtle.importKey('raw', secret, options, true, usage);
}

async function encrypt(message, keyFile) {
  /** Encrypt a message using a CryptoKey object.
   * */
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cipherBytes = await crypto.subtle
    .encrypt({ name: 'AES-CBC', iv }, keyFile, ec.encode(message))
    .then((bytes) => new Uint8Array(bytes));
  // Return a concatenated and base64 encoded array.
  return b64encode(new Uint8Array([...iv, ...cipherBytes]));
}

async function decrypt(encodedText, keyFile) {
  /** Decrypt an encrypted message using a CryptoKey object.
   * */
  const bytes = b64decode(encodedText);
  const plainText = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: bytes.slice(0, 16) },
    keyFile,
    bytes.slice(16)
  );
  return dc.decode(plainText);
}

function bytesToHex(byteArray) {
  for (var arr = [], i = 0; i < byteArray.length; i++) {
    arr.push(byteArray[i].toString(16).padStart(2, '0'));
  }
  return arr.join('');
}

function hexToBytes(str) {
  for (var arr = [], i = 0; i < str.length; i += 2) {
    arr.push(parseInt(str.substr(i, 2), 16));
  }
  return Uint8Array.from(arr);
}

function sign(msg, key) {
  return schnorr.sign(msg, key);
}

function verify(sig, msgHash, pubKey) {
  return schnorr.verify(sig, msgHash, pubKey);
}

function getRandomBytes(size = 32) {
  return crypto.getRandomValues(new Uint8Array(size));
}

function getRandomString(size = 32) {
  return bytesToHex(getRandomBytes(size));
}

function encodeShareLink(secret, relayUrl) {
  const str = `${secret}@${relayUrl}`
  return (NostrEmitter.globals.isBrowser)
    ? btoa(str)
    : Buffer.from(str, 'utf8').toString('base64')
}

function decodeShareLink(str) {
  const decoded = (NostrEmitter.globals.isBrowser)
    ? atob(str)
    : Buffer.from(str, 'base64').toString('utf8')
  return decoded.split('@')
}

NostrEmitter.utils = {
    hash,
    getSignKeys,
    getSharedKey,
    encrypt,
    decrypt,
    sign,
    verify,
    bytesToHex,
    hexToBytes,
    getRandomBytes,
    getRandomString,
    b64encode,
    b64decode,
    encodeShareLink,
    decodeShareLink
  }

// Handle exports between browser and node.
if (isBrowser) {
  window.NostrEmitter = NostrEmitter;
} else {
  module.exports = NostrEmitter;
}

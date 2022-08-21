import * as crypt from './crypto.js'

const DEFAULT_OPT = {
  version: 0,
  kind: 9001
}

const DEFAULT_FILTER = {
  'since': Math.floor(Date.now() / 1000)
}

export default class NostrEmitter {
  constructor(config = {}) {

    if (!config.relayUrl) {
      throw new Error('Must provide url to a relay!')
    }

    this.keys = { 
      priv: null,
      pub: null,
      shared: null
    }

    this.events = []
    this.tags   = []
    this.url    = config.relayUrl
    this.topic  = config.topic  || 'general'
    this.secret = config.secret || ''
    this.socket = new WebSocket(this.url)
    this.opt    = { ...DEFAULT_OPT, ...config.opt }

    this.filter = {
      'kinds': [ this.opt.kind ],
      ...DEFAULT_FILTER,
      ...config.filter,
    }

    this.socket.addEventListener('open', (event) => {
      console.log('Socket connected to: ', this.url)
      this.subscribe()
    })

    this.socket.addEventListener('message', async (event) => {
      const [ type, subId, data ] = JSON.parse(event.data)
      const { content, ...metaData } =  data || {};

      if (type === 'EOSE') {
        console.log('subscription active:', subId)
      }

      if (!content) return

      const decrypted = await crypt.decrypt(content, this.keys.shared)
      const { eventName, eventData } = JSON.parse(decrypted)

      this._getEventListByName(eventName).forEach(function(fn) {
        fn.apply(this, [ ...eventData, metaData ])
      }.bind(this))
    })

    return new Promise((res, rej) => {
      crypt.genSignKeys()
        .then(({ private: priv, public: pub }) => this.keys = { priv, pub })
        .then(() => crypt.importKey(this.topic + this.secret))
        .then((shared) => this.keys.shared = shared)
        .then(() => crypt.hash(this.topic.concat(this.secret)))
        .then((hashStr) => {
          console.log(hashStr)
          this.tags.push(["s", hashStr])
          this.filter['#s'] = [ hashStr ]
        })
        .then(() => res(this))
        .catch((err) => rej(err))
    })
  }

  async subscribe() {
    const subId = crypto.randomUUID()
    const subscription = [ "REQ", subId, this.filter ]
    console.log('subscription:', subscription)
    this.socket.send(JSON.stringify(subscription))
  }

  async send(eventName, eventData) {
    const serialData = JSON.stringify({ eventName, eventData })
    const event = {
      "content"    : await crypt.encrypt(serialData, this.keys.shared),
      "created_at" : Math.floor(Date.now() / 1000),
      "kind"       : this.opt.kind,
      "tags"       : this.tags,
      "pubkey"     : this.keys.pub
    }

    const signedEvent = await this.getSignedEvent(event)

    console.log('Serialized event:', JSON.stringify(signedEvent))
    
    // Serialize and send our message.
    this.socket.send(JSON.stringify([ "EVENT", signedEvent ]))
  }

  async getSignedEvent(event) {
    /** Produce a signed hash of our event, attach it
     *  to the event object, then serialize the result.
     */
    const eventData = JSON.stringify([
      0,		                // Reserved for future use.
      event['pubkey'],	    // The sender's public key
      event['created_at'],  // Unix timestamp.
      event['kind'],		    // Message “kind” or type.
      event['tags'],		    // Tags – identify replies or recipients.
      event['content']      // Your note contents.
    ])

    event.id  = await crypt.hash(eventData)
    event.sig = await crypt.sign(event.id, this.keys.priv)

    if (!crypt.verify(event.sig, event.id, event.pubkey)) {
      throw 'event signature failed verification!'
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
  
  removeListener(eventName, fn) {
    /** Remove function from an event's subscribtion list. */
    this._getEventListByName(eventName).delete(fn)
  }
}
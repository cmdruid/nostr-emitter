import * as crypt from './crypto.js'

const DEFAULT_OPT = {
  version: 0,
  kind: 70736274
}

export default class NostrEmitter {
  constructor(config = {}) {

    if (!config.relayUrl) {
      throw new Error('Must provide url to a relay!')
    }

    this.keys   = { 
      private: null,
      public: null,
      shared: null
    }

    this.events = []
    this.url    = config.relayUrl
    this.topic  = config.topic  || 'general'
    this.secret = config.secret || ''
    this.socket = new WebSocket(this.url)
    this.opt    = { ...DEFAULT_OPT, ...config.opt }
    this.filter = { ...config.filter, 'kinds': [ this.opt.kind ]}

    this.socket.addEventListener('open', (event) => {
      console.log('connected!')
      const subscription = [ "REQ", 'id', this.filter ]
      console.log('subscription:', subscription)
      this.socket.send(JSON.stringify(subscription))
      console.log('Socket connected to: ', this.url)
    })

    this.socket.addEventListener('message', async (event) => {
      const [ type, subId, data ] = JSON.parse(event.data)
      const { content, timestamp, kind, tags } =  data || {};

      if (!content) return

      if (kind === 4) {
        // We have an encrypted message!
        content = await crypt.decrypt(content, this.keys.shared)
      }

      const { eventName, eventData } = JSON.parse(content)

      this._getEventListByName(eventName).forEach(function(fn) {
        fn.apply(this, eventData)
      }.bind(this))
    })

    return new Promise((res, rej) => {
      crypt.genSignKeys()
        .then(({ priv, pub }) => {
          console.log(priv, pub)
          this.keys = { priv, pub }
        })
        .then(() => crypt.importKey(this.topic + this.secret))
        .then((shared) => this.keys.shared = shared)
        .then(() => res(this))
    })
  }

  async send(eventName, eventData,) {
    const event = {
      "content"    : { eventName, eventData },
      "created_at" : Math.floor( Date.now() / 1000 ),
      "kind"       : this.opt.kind,
      "tags"       : this.opt.tags,
      "pubkey"     : this.keys.public,
    }

    const signedEvent = await this.getSignedEvent(event)
    
    // Serialize and send our message.
    socket.send(JSON.stringify([ "EVENT", signedEvent ]))
  }

  async getSignedEvent(event) {
    /** Produce a signed hash of our event, attach it
     *  to the event object, then serialize the result.
     */
    var eventData = JSON.stringify([
      0,		                // Reserved for future use.
      event['pubkey'],	    // The sender's public key
      event['created_at'],  // Unix timestamp.
      event['kind'],		    // Message “kind” or type.
      event['tags'],		    // Tags – identify replies or recipients.
      event['content']      // Your note contents.
    ])

    event.id  = crypt.hash(eventData).toString('hex')
    event.sig = await crypt.sign(event.id, this.keys.private)
    
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
    this.send(eventName, { ...args})
  }
  
  removeListener(eventName, fn) {
    /** Remove function from an event's subscribtion list. */
    this._getEventListByName(eventName).delete(fn)
  }
}
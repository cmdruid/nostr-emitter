import { NostrClient }  from '@/class/client'
import { Cipher }       from '@/class/cipher'
import { EventEmitter } from '@/class/emitter'
import { Subscription } from '@/class/subscription'
import { SignedEvent }  from '@/class/event/SignedEvent'
import { EmitEvent }    from '@/class/event/EmitEvent'

import {
  AckEnvelope,
  EventDraft,
  Json,
  TopicOptions
} from '@/schema/types'

export class TopicEmitter extends EventEmitter<{
  'ready' : [ TopicEmitter ]
  [ k : string ] : any[]
}> {

  private readonly _topic    : string
  public  readonly client    : NostrClient
  public  readonly sub       : Subscription
  public  readonly encrypted : boolean

  constructor(
    client  : NostrClient,
    topic   : string,
    options : TopicOptions = {}
  ) {
    const { filter, encrypt = false } = options

    super()
    this._topic = topic
    this.client = client
    this.sub    = new Subscription(this.client, filter)
    this.encrypted = encrypt

    this.sub._updateHook = this._updateHook.bind(this)
    this.sub.on('event', this._eventHandler.bind(this))
    this.sub.on('ready', () => this.emit('ready', this))
  }

  public get cipher () : Promise<Cipher> {
    return Cipher.from(this._topic)
  }

  public get topic () : Promise<string> {
    return (this.encrypted)
      ? this.cipher.then(cipher => cipher.hashtag)
      : new Promise(res => res(this._topic))
  }

  async _eventHandler(event : SignedEvent) : Promise<void> {
    const emitEvent = new EmitEvent(event, this)
    const isEncrypted = (this.encrypted && await emitEvent.isDecipherable) 
    const [ eventName, payload ] = (isEncrypted)
      ? JSON.parse(await emitEvent.decrypt())
      : emitEvent.content
    this.emit(eventName, payload, emitEvent)
  }

  async _updateHook() : Promise<void> {
    const tag = await this.topic
    this.sub.filter['#t'] = [ tag ]
  }

  public async send (
    eventName : string,
    payload   : Json,
    template ?: EventDraft
  ) : Promise<AckEnvelope | undefined> {
    let tags    = template?.tags ?? []
    let content = JSON.stringify([ eventName, payload ])

    if (this.encrypted) {
      const cipher = await this.cipher
      content = await cipher.encrypt(content)
    }

    tags.push(['t', await this.topic])
    return this.client.publish({ ...template, content, tags })
  }
}

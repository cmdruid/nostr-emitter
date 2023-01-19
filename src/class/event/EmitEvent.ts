import { TopicEmitter } from '@/class/topic'
import { SignedEvent }  from '@/class/event/SignedEvent'
import { Base64 }       from '@/lib/format'
import { Tag }          from '@/schema/types'

export class EmitEvent extends SignedEvent {
  public readonly emitter : TopicEmitter

  constructor(
    event   : SignedEvent,
    emitter : TopicEmitter
  ) {
    super(event.toJSON(), emitter.client)
    this.emitter = emitter
  }

  public get isEncoded () : boolean {
    return (
      typeof this.content === 'string' &&
      this.content.search(/^[a-zA-Z0-9+/]+={0,2}$/) === 0
    )
  }

  public get vector () : Uint8Array | undefined {
    if (this.isEncoded) {
      return Base64.decode(this.content as string).slice(0, 16)
    } else { return undefined }
  }

  public get hashtags () : Tag[] {
    return this.tags
      .filter(t => t[0] === 't')
      .map(t => t[1])
  }

  public get isDecipherable () : Promise<boolean> {
    return this.emitter.topic.then(topic =>
      (
        this.isEncoded && topic !== undefined &&
        this.hashtags.includes(topic)
      )
    )
  }

  public async decrypt () : Promise<string> {
    const cipher = await this.emitter.cipher
    if (cipher !== undefined && this.isEncoded) {
      return cipher.decrypt(this.content as string)
    } else { throw TypeError('Event content failed to decrypt!') }
  }
}

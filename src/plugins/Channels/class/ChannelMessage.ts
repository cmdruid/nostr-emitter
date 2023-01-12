import { NostrClient } from '@/client'
import { SignedEvent } from '@/event'
import { Base64 }      from '@/format'
import { Event, Json, Tag } from '@/types'

export class Channel<T = Json> extends SignedEvent<T> {
  constructor(
    event  : Event<T>,
    client : NostrClient
  ) {
    super(event, client)
  }

  public get vector () : Uint8Array | undefined {
    if (this.isEncoded) {
      return Base64.decode(this.content as string).slice(0, 16)
    } else { return undefined }
  }

  public get hashtags () : Tag[] {
    return this.tags
      .filter(t => t[0] === 'h')
      .map(t => t[1])
  }

  public get isDecipherable () : boolean {
    const hashtag = this.client.hashtag
    return (
      this.isEncoded && hashtag !== undefined &&
      this.hashtags.includes(hashtag)
    )
  }

  public async decrypt () : Promise<string> {
    const cipher = this.client.cipher
    if (cipher !== undefined && this.isEncoded) {
      return cipher.decrypt(this.content as string)
    } else { throw TypeError('Event content failed to decrypt!') }
  }
}

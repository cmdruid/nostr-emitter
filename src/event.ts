import { NostrClient } from './client.js'
import { Base64 }      from './format.js'
import { KeyPair }     from './keypair.js'
import { Event, Tag }  from './types.js'

export class SignedEvent<T> implements Event<T> {
  public readonly event  : Event<T>
  public readonly client : NostrClient<T>

  constructor (
    event  : Event<T>,
    client : NostrClient<T>
  ) {
    this.event  = event
    this.client = client
  }

  public get isAuthor () : boolean {
    return this.pubkey === this.client.pubkey
  }

  public get isValid () : Promise<boolean> {
    return KeyPair.verify(this.sig, this.id, this.pubkey)
  }

  public get id () : string {
    return this.event.id
  }

  public get kind () : number {
    return this.event.kind
  }

  public get created_at () : number {
    return this.event.created_at
  }

  public get pubkey () : string {
    return this.event.pubkey
  }

  public get subject () : string | undefined {
    return this.event.subject
  }

  public get content () : T {
    return this.event.content
  }

  public get vector () : Uint8Array | undefined {
    if (this.isEncoded) {
      return Base64.decode(this.content as string).slice(0, 16)
    } else { return undefined }
  }

  public get sig () : string {
    return this.event.sig
  }

  public get tags () : Tag[][] {
    return this.event.tags
  }

  public get members () : Tag[][] {
    return this.tags
      .filter(t => t[0] === 'p')
      .map(t => t.slice(1))
  }

  public get sources () : Tag[][] {
    return this.tags
      .filter(t => t[0] === 'e')
      .map(t => t.slice(1))
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

  public get isEncoded () : boolean {
    return (
      typeof this.content === 'string' &&
      this.content.search(/^[a-zA-Z0-9+/]+={0,2}$/) === 0
    )
  }

  public async decrypt () : Promise<string> {
    const cipher = this.client.cipher
    if (cipher !== undefined && this.isEncoded) {
      return cipher.decrypt(this.content as string)
    } else { throw TypeError('Event content failed to decrypt!') }
  }

  public toJSON () : Event<T> {
    return this.event
  }
}

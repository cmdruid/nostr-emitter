import { NostrClient } from './client.js'
import { KeyPair }     from './keypair.js'
import { Event, Json, Tag } from './types.js'

export class SignedEvent<T = Json> implements Event<T> {
  public readonly event  : Event<T>
  public readonly client : NostrClient

  constructor (
    event  : Event<T>,
    client : NostrClient
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

  public get isEncoded () : boolean {
    return (
      typeof this.content === 'string' &&
      this.content.search(/^[a-zA-Z0-9+/]+={0,2}$/) === 0
    )
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

  public toJSON () : Event<T> {
    return this.event
  }
}

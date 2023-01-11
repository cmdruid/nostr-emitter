import { SignedEvent } from './event.js'

export type Tag     = string  | number | boolean
export type Literal = string  | number | boolean | null
export type Json    = Literal | Json[] | { [key : string] : Json }

export interface Config {
  kind    ?: number
  tags    ?: string[][]
  selfsub ?: boolean
  filter  ?: Filter
}

export interface Options {
  kind    : number
  tags    : string[][]
  selfsub : boolean
  filter  : Filter
}

export interface Event<T = Json> {
  id         : string
  kind       : number
  created_at : number
  pubkey     : string
  subject   ?: string
  content    : T
  sig        : string
  tags       : Tag[][]
}

export interface EventDraft<T> {
  id         ?: string
  kind       ?: number
  created_at ?: number
  pubkey     ?: string
  subject    ?: string
  content    ?: T
  sig        ?: string
  tags        : Tag[][]
}

export interface EventTemplate {
  id        ?: string
  kind       : number
  created_at : number
  pubkey     : string
  subject   ?: string
  content    : string
  sig       ?: string
  tags       : Tag[][]
}

export type EventEnvelope<T> = [
  data : T,
  meta : Event<T> | SignedEvent<T>
]

export type ContentEnvelope<T> = [
  key  : string,
  data : T
]

export interface Filter {
  ids     ?: string[]
  authors ?: string[]
  kinds   ?: number[]
  since   ?: number
  until   ?: number
  limit   ?: number
  [ key : string ] : Tag | Tag[] | undefined
}
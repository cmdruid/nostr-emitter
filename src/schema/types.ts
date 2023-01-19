import { SignedEvent } from '@/class/event/SignedEvent'

export type Tag     = string  | number | boolean
export type Literal = string  | number | boolean | null
export type Json    = Literal | Json[] | { [key : string] : Json }

export type Sorter<T> = (a : T, b : T) => number

export interface ClientConfig {
  kind    ?: number
  tags    ?: string[][]
  selfsub ?: boolean
  timeout ?: number
  filter  ?: Filter
  privkey ?: string | Uint8Array
}

export interface ClientOptions {
  kind    : number
  tags    : string[][]
  selfsub : boolean
  timeout : number
  filter  : Filter
}

export interface TopicOptions {
  filter  ?: Filter
  encrypt ?: boolean
}

export interface Event {
  id         : string
  kind       : number
  created_at : number
  pubkey     : string
  subject   ?: string
  content    : Json
  sig        : string
  tags       : Tag[][]
}

export interface EventDraft {
  id         ?: string
  kind       ?: number
  created_at ?: number
  pubkey     ?: string
  subject    ?: string
  content    ?: Json
  sig        ?: string
  tags       ?: Tag[][]
}

export interface EventTemplate {
  id        ?: string
  kind       : number
  created_at : number
  pubkey     : string
  subject   ?: string
  content    : Json
  sig       ?: string
  tags       : Tag[][]
}

export type EventEnvelope = [
  data : Json,
  meta : Event | SignedEvent
]

export type ContentEnvelope = [
  key  : string,
  data : Json
]

export type AckEnvelope = [
  eventId : string,
  success : boolean,
  message : string
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

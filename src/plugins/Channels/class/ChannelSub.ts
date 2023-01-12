import { NostrClient }  from "@/client"
import { Subscription } from "@/subscription"
import { Filter }       from "@/types"

export class ChannelSub<T> extends Subscription<T> {
  
  constructor(
    filter : Filter,
    client : NostrClient
  ) {
    super(filter, client)
  }
}
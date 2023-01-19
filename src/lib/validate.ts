import { SignedEvent } from '@/class/event/SignedEvent'
import { NostrClient } from '@/class/client'

export async function validateEvent (
  event  : SignedEvent,
  client : NostrClient
) : Promise<SignedEvent | null> {
  // Verify that the signature is valid.
  if (!await event.isValid) {
    return null
  }

  // If the event is from ourselves, check the filter rules.
  if (event.isAuthor && !client.options.selfsub) {
    return null
  }

  return event
}

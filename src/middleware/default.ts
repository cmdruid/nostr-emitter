import { SignedEvent } from "@/event"

export async function validateEvent<T> (
  event : SignedEvent<T>
) : Promise<SignedEvent<T> | null> {
  // Verify that the signature is valid.
  if (!await event.isValid) {
    return null
  }

  // If the event is from ourselves, check the filter rules.
  if (event.isAuthor && !event.client.options.selfsub) {
    return null
  }

  return event
}

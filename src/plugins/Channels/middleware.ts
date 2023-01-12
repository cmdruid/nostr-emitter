export async function channelMiddleware() {
  let content : ContentEnvelope<T> | T  | string = event.content

  if (event.isDecipherable) {
    content = await event.decrypt()
  }

  if (typeof content === 'string') {
    content = Text.revive(content)
  }

  this.emit('debug', content)
  this.emit('debug', event)

  // If the decrypted content is empty, destroy the event.
  if (Array.isArray(content)) {
    // Apply the event to our subscribed functions.
    const [ eventName, eventData ] = content
    this.event.emit(eventName, eventData, event)
  } else { this.event.emit('any', content as T, event) }
}

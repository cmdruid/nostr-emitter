/**
 * NostrChannel
 * 
 * An implementation of encrypted channels using Nostr.
 * 
 * NOTES:
 * - Channel state is stored in a replaceable event.
 *   The metadata of the channel is stored in the content
 *   field. The membership (and keys) for the channel is
 *   stored in the tag information.
 * 
 * - Any member can claim to be the leader of the channel.
 *   The visibility of messages between members is based
 *   on a simple consensus of election. Only members whom
 *   elect the same leader can see each others messages,
 *   because the owner controls the shared channel secret.
 * 
 * - Members subscribe the the channel state in order to 
 *   receive up-to-date keys for the channel.
 * 
 */

export class NostrChannel {
  public readonly state : ChannelState
  public readonly event : ChannelEvent 

  constructor() {

  }
}
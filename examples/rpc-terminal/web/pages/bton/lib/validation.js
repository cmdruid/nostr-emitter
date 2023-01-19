/* TODO:
 - bech32 encoded url strings. (btsc1)
 - sha256 hashed template of contract opcodes (with version).
 - sha256 hashed template of contract metadata (with version).
 - sha256 hash of arguments for each party (grouped by meta).

 Example flow:
 * Alice scans QR code with her phone (or copy/paste).
 * Alice decodes urlstring and makes request for contract.
 * Request includes contract template and meta hashes.
 * Alice independently verifies the template and metadata.
 * Alice opens a channel based on a shared secret.
 * Alice creates a hash of non-negotiable arguments for each
   party of the contract
 * Alice attaches an event listener to the hash.
 * Other parties which agree to the arguments will know the hash.
 * Each party can use the hash to transmit their signature, plus
   the non-specified arguments required for the contract.
 * Once all the signatures are sent, transaction can be broadcast.
 */
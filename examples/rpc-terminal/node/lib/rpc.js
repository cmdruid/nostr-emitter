import { getRandomHex } from './crypto.js'

export default async function rpc(method, args = [], opt = {}) {
  /** Send a JSON-RPC call to the configured server. */

  const user = opt.user   || 'bitcoin',
        pass = opt.pass   || 'password',
        url  = opt.url    || 'http://127.0.0.1',
        port = opt.port   || '18443',
        wall = opt.wallet || null

  // Random identifer for our request.
  const requestId = getRandomHex()

  // Authorization string for our request.
  const authString = Buffer.from(user + ':' + pass).toString('base64')

  // Make sure our args are in an array.
  args = (Array.isArray(args)) ? args : [ args ]

  // Confgigure our request object.
  const request = {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + authString,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      "jsonrpc": "1.0",
      "id": requestId,
      "method": method,
      "params": args
    })
  }

  // Configure our URL to include a wallet, if provided.
  const baseUrl = (wall)
    ? `${url}:${port}/wallet/${wall}`
    : `${url}:${port}`

  // Fetch a response from our node.
  const response = await fetch(baseUrl, request)

  // If the response fails, throw an error.
  if (!response.ok && !response.json) {
    throw new Error(`Request for '${method}' failed with status ${response.status}: ${response.statusText}`)
  }

  // Convert our response to json.
  const { result, error } = await response.json()

  // If the RPC call has an error, unpack and throw the error.
  if (error) {
    const { code, message } = error
    if (code === -1) {
      throw new Error(`RPC command ${method} failed with syntax error. Please check your arguments.`)
    } else { 
      throw new Error(`RPC command ${method} failed with error: ${message}`)
    }
  }

  return result
}

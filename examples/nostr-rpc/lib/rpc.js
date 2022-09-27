const { webcrypto: crypto } = require('crypto')

async function rpc(method, args = [], config = {}) {
  /** Send a JSON-RPC call to the configured server. */

  const user = config.user   || 'bitcoin',
        pass = config.pass   || 'password',
        url  = config.url    || 'http://127.0.0.1',
        port = config.port   || '18443'

  // Random identifer for our request.
  const requestId = crypto.randomUUID()

  // Authorization string for our request.
  const authString = Buffer.from(user + ':' + pass).toString('base64')

  // Make sure our args are in an array.
  args = (Array.isArray(args)) ? args : [ args ]

  try {

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

    // Fetch a response from our node.
    const response = await fetch(`${url}:${port}`, request)

    // If the response fails, throw an error.
    if (!response.ok && !response.json) {
      throw `Request for '${method}' failed with status ${response.status}: ${response.statusText}`
    }

    // Convert our response to json.
    const { result, error } = await response.json()

    // If the RPC call has an error, unpack and throw the error.
    if (error) {
      const { code, message } = error
      if (code === -1) {
        throw `RPC command ${method} failed with syntax error. Please check your arguments.`
      } else { throw `RPC command ${method} failed with error: ${message}` }
    }

    return result

  } catch(err) { console.log(err) }
}

module.exports = rpc
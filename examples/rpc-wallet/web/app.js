/* Fetch our configured socket. */

const events = [];     // Store our event messages in here.
const MAX_EVENTS = 25  // We'll prune messages after this amount.

const infoWindow  = document.querySelector('.info-window pre')
const termWindow  = document.querySelector('.terminal-window')
const eventWindow = document.querySelector('.event-window')
const connInput   = document.querySelector('.connect-prompt input')
const connButton  = document.querySelector('.connect-btn')
const termInput   = document.querySelector('.terminal-prompt input')
const sendButton  = document.querySelector('.send-btn')

connInput.addEventListener('keypress', e => {
    /* Capture 'enter' keypress from the command line. */
    if (e.key === 'Enter') connect(e.target.value) 
  });

connButton.addEventListener('click', e => {
  /* Capture mouse-clicks on our enter button. */
  connect(connInput.value)
})

const emitter = new NostrEmitter()

/* When the socket connects, fetch info from our node. */
emitter.on('nodeinfo', data => {
  /* Unpack our big fat data object. */
  const { alias, balance, blockct, chain } = data

  /* Do something cool, like change our username to the node alias. */
  const username = document.querySelector('.prompt-user')
  username.textContent = `${alias.toLowerCase()}@node`

  /* Change the window contents to our formatted string. */
  infoWindow.textContent = `balance: ${balance} | network: ${chain} | blockheight: ${blockct}`
});



termInput.addEventListener('keypress', e => {
  /* Capture 'enter' keypress from the command line. */
  if (e.key === 'Enter') sendCommand(e.target.value) 
});

sendButton.addEventListener('click', e => {
  /* Capture mouse-clicks on our enter button. */
  sendCommand(termInput.value)
})

function sendCommand(str) {
  /* Parse our command string and send it over the wire. */
  const [ command, ...args ] = str.split(' ')
  emitter.on('response', data => {
    /* Setup our callback for the command response. */
    const termEntry = document.createElement("pre")
    termEntry.classList.add("term-entry")
    termEntry.textContent = format(data)
    termWindow.replaceChildren()
    termWindow.append(termEntry)
    termWindow.scrollTo({ top: 0 })
  });
  /* Send the command and reset our command line. */
  emitter.emit('call', [ command, ... args ])
  termInput.value = ""
  input.style.width = 0
}

function format(json) {
  /* Convert ugly json objects into pretty text. */
  let text = JSON.stringify(json, null, 1)
  if (text.startsWith('{')) text = text.slice(2, -2)
  return text
}

async function connect(str) {
  const [ relayUrl, secret ] = atob(str).split(':')
  await emitter.connect('wss://' + relayUrl, secret)
  emitter.emit('getinfo')
}

const input = document.querySelector('.input-field')

input.querySelector('input').addEventListener('input', (e) => {
  const length = Math.min(e.target.value.length * 0.5 + 0.2, 20)
  input.style.width = length + 'rem'
})

const inputBar = document.querySelector('.input-bar')

inputBar.addEventListener('click', (e) => {
  input.querySelector('input').focus()
})
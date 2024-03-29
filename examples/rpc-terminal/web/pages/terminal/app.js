console.log('Terminal app loaded!')

const FRAME_SIZE = '40em'

const termWindow  = document.querySelector('.terminal-output')
const commandLine = document.querySelector('.command-line')
const inputField  = document.querySelector('.input-field')
const inputCursor = document.querySelector('.input-cursor')
const sendButton  = document.querySelector('.send-btn')

window.parent.dispatchEvent(
  new CustomEvent('resizeFrame', { detail: FRAME_SIZE })
)

window.addEventListener('blur', (e) => {
  inputCursor.classList.add('hide')
})

window.addEventListener('click', (e) => {
  if (e.target === commandLine) {
    inputCursor.classList.remove('hide')
    inputField.querySelector('input').focus()
  } else {
    inputCursor.classList.add('hide')
  }
})

inputField.addEventListener('input', (e) => {
  const length = Math.min(e.target.value.length * 0.5 + 0.2, 20)
  inputField.style.width = length + 'rem'
})

inputField.addEventListener('keypress', e => {
  /* Capture 'enter' keypress from the command line. */
  if (e.key === 'Enter') sendCommand(e.target.value)
})

sendButton.addEventListener('click', e => {
  /* Capture mouse-clicks on our enter button. */
  sendCommand(termInput.value)
})

const emitter = new NostrEmitter()

await connect()

async function connect() {
  const connectStr = localStorage.getItem('connectString')
  const [ secret, address ] = connectStr.split('@')
  emitter.connect(address, secret)
}

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
  })
  /* Send the command and reset our command line. */
  emitter.publish('call', [ command, ... args ])
  inputField.value = ""
  inputField.style.width = 0
}

function format(json) {
  /* Convert ugly json objects into pretty text. */
  let text = JSON.stringify(json, null, 1)
  if (text.startsWith('{')) text = text.slice(2, -2)
  return text
}




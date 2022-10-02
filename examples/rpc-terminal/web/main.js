// Query the nessecary document elements.
const menuItems  = document.querySelectorAll('.menu ul li p')
const viewFrame  = document.querySelector('.view-frame')
const connInput  = document.querySelector('.connect-prompt input')
const connButton = document.querySelector('.connect-btn')
const infoWindow = document.querySelector('.info-window pre')

// Setup the event emitter.
const emitter = new NostrEmitter()

// Configure listeners for menu items.
for (const item of menuItems) {
  item.addEventListener('click', (e) => {
    const title = item.textContent
    menuItems.forEach(e => e.classList.remove('active'))
    e.target.classList.add('active')
    viewFrame
      .querySelector('.title p')
      .textContent = title
    viewFrame
      .querySelector('iframe')
      .setAttribute('src', `./pages/${title.toLowerCase()}/index.html`)
  })
}

// Configure listeners for connect dialog.
connInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') connect(e.target.value)
});

connButton.addEventListener('click', e => {
  connect(connInput.value)
})

emitter.on('nodeinfo', data => {
  // When the socket connects, fetch info from our node.
  const { balance, blockct, chain } = data
  infoWindow.textContent = `balance: ${balance} | network: ${chain} | blockheight: ${blockct}`
});

emitter.on('error', (err) => {
  // Capture any errors.
  console.error('Emitter received error:', err)
})

async function connect(str) {
  const [ relayUrl, secret ] = atob(str).split(':')
  localStorage.setItem('connectString', str)
  await emitter.connect('wss://' + relayUrl, secret)
  emitter.emit('getinfo')
  document.querySelector('#default').click()
}

function main() {
  const savedString = localStorage.getItem('connectString')
  if (savedString) {
    connInput.setAttribute('value', localStorage.getItem('connectString'))
    connect(savedString)
  }
}

main()

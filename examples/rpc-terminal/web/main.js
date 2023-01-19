// Query the nessecary document elements.
const menuItems  = document.querySelectorAll('.menu ul li p')
const viewFrame  = document.querySelector('.view-frame')
const connInput  = document.querySelector('.connect-prompt input')
const connButton = document.querySelector('.connect-btn')
const infoWindow = document.querySelector('.info-window pre')

// Setup the event emitter.
const emitter = new NostrEmitter()

let interval, REFRESH_INTERVAL = 5000

window.global = {
  frameHeight: '25'
}

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
window.addEventListener('resizeFrame', (event) => {
  viewFrame.style.height = event.detail
})

connInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') connect(e.target.value)
});

connButton.addEventListener('click', e => {
  localStorage.setItem('connectString', connInput.value)
  connect(connInput.value)
})

emitter.on('nodeinfo', (data) => {
  console.log(data)
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
  document.querySelector('#default').click()
  await emitter.connect('wss://' + relayUrl, secret)
  if (emitter.connected) {
    emitter.emit('getinfo')
    clearInterval(interval)
    interval = setInterval(() => { 
      emitter.emit('getinfo') 
    }, REFRESH_INTERVAL)
  }
}

function main() {
  const savedString = localStorage.getItem('connectString')
  if (savedString) {
    connInput.setAttribute('value', localStorage.getItem('connectString'))
    connect(savedString)
  }
}

main()

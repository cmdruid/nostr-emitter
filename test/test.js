const NostrEmitter = require('../index.js')

const emitter = new NostrEmitter({
  selfPub: true
})

async function main() {
  await emitter.connect(
    'wss://nostr-relay.wlvs.space',
    'secret-string'
  )

  try {
    emitter.within('test', (data, meta) => {
      console.log(data, meta)
    }, 1000)
    setTimeout(() => { emitter.emit('test', 'testdata')}, 3000)
  } catch(err) {
    console.error(err)
  }
}

main()

const test = require('tape')
const NostrEmitter = require('../index.js')

const sleep = ms => new Promise(done => setTimeout(done, ms || 1000))

const emitter = new NostrEmitter({ selfsub: true })

test('Event Registration', async t => {
  await emitter.connect('wss://nostr.zebedee.cloud', 'secret-string')

  try {
    t.test('onTest', t => onTest(t, emitter), 'Test .on()')
    t.test('onceTest', t => onceTest(t, emitter), 'Test .once()')
    t.test('withinTest', t => withinTest(t, emitter), 'Test .within()')
  } catch(err) { console.error(err) }
  
  t.teardown(() => {
    console.log('closing socket...')
    emitter.close()
  })
})

async function onTest(t, emitter) {
  let state = null
  t.plan(1)
  emitter.on('onTest', data => state = data)
  emitter.emit('onTest', 'pass 1')
  await sleep(1000)
  t.equal('pass 1', state, 'should update the state.')
}

async function onceTest(t, emitter) {
  let state = null

  t.plan(2)

  emitter.once('onceTest', data => state = data)

  emitter.emit('onceTest', 'pass 1')
  await sleep(1000)
  t.equal('pass 1', state, 'should update the state.')

  emitter.emit('onceTest', 'pass 2')
  await sleep(1000)
  t.notEqual('pass 2', state, 'should fail to update the state.')
}

async function withinTest(t, emitter) {
  let state = null

  t.plan(3)

  emitter.within('withinTest', (data) => state = data, 2000)

  emitter.emit('withinTest', 'pass 1')
  await sleep(1000)
  t.equal('pass 1', state, 'should update, is within the timeout')

  emitter.emit('withinTest', 'pass 2')
  await sleep(1000)
  t.equal('pass 2', state, 'should update, is within the timeout')

  emitter.emit('withinTest', 'pass 3')
  await sleep(1000)
  t.notEqual('pass 3', state, 'should fail to update, is outside the timeout')
}

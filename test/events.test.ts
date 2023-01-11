import tape, { Test } from 'tape'

import { 
  NostrClient, 
  NostrEmitter, 
  KeyPair
} from '../src/index.js'

const sleep = (ms : number) => new Promise(done => setTimeout(done, ms || 1000))

const { prvkey, pubkey } = KeyPair.random()

const client  = new NostrClient<string>(prvkey, { selfsub: true })
const emitter = await client.connect('wss://relay-pub.deschooling.us', 'secret-string')

tape('Event Registration', async t => {
  
  t.test('onTest',     t => onTest(t, emitter))
  t.test('onceTest',   t => onceTest(t, emitter))
  t.test('withinTest', t => withinTest(t, emitter))
  
  t.teardown(() => {
    console.log('closing socket...')
    if (client.socket !== undefined) {
      client.socket.close()
    }
  })
})

async function onTest(t : Test, emitter : NostrEmitter<string>) {
  let state = ''
  t.plan(1)
  emitter.on('onTest', (data, _) => {
    state = data
  })
  emitter.relay('onTest', 'pass 1')
  await sleep(1000)
  t.equal('pass 1', state, 'should update the state.')
}

async function onceTest(t : Test, emitter : NostrEmitter<string>) {
  let state = ''

  t.plan(2)

  emitter.once('onceTest', (data, _) => {
    state = data
  })

  emitter.relay('onceTest', 'pass 1')
  await sleep(1000)
  t.equal('pass 1', state, 'should update the state.')

  emitter.relay('onceTest', 'pass 2')
  await sleep(1000)
  t.notEqual('pass 2', state, 'should fail to update the state.')
}

async function withinTest(t : Test, emitter : NostrEmitter<string>) {
  let state = ''

  t.plan(3)

  emitter.within('withinTest', (data, _) => {
    state = data
  }, 2000)

  emitter.relay('withinTest', 'pass 1')
  await sleep(1000)
  t.equal('pass 1', state, 'should update, is within the timeout')

  emitter.relay('withinTest', 'pass 2')
  await sleep(1000)
  t.equal('pass 2', state, 'should update, is within the timeout')

  emitter.relay('withinTest', 'pass 3')
  await sleep(1000)
  t.notEqual('pass 3', state, 'should fail to update, is outside the timeout')
}

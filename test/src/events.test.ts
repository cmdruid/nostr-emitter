import { Test }  from 'tape'
import { sleep } from './utils.js'

import { NostrClient, TopicEmitter } from '../../src/index.js'

const client  = new NostrClient({ selfsub: true })
const emitter = client.topic('testing')

await client.connect('wss://nostr.zebedee.cloud')

export function eventTests(t : Test) {
  t.test('onTest',     t => onTest(t, emitter))
  t.test('onceTest',   t => onceTest(t, emitter))
  t.test('withinTest', t => withinTest(t, emitter))
  
  t.teardown(() => {
    console.log('\nclosing socket...')
    client.close()
  })
}

async function onTest(t : Test, emitter : TopicEmitter) {
  let state = ''
  t.plan(1)
  emitter.on('onTest', (data, _) => {
    state = data
  })
  emitter.relay('onTest', 'pass 1')
  await sleep(1000)
  t.equal(state, 'pass 1', 'should update the state.')
}

async function onceTest(t : Test, emitter : TopicEmitter) {
  let state = ''

  t.plan(2)

  emitter.once('onceTest', (data, _) => {
    state = data
  })

  emitter.relay('onceTest', 'pass 1')
  await sleep(1000)
  t.equal(state, 'pass 1', 'should update the state.')

  emitter.relay('onceTest', 'pass 2')
  await sleep(1000)
  t.notEqual(state, 'pass 2', 'should fail to update the state.')
}

async function withinTest(t : Test, emitter : TopicEmitter) {
  let state = ''

  t.plan(3)

  emitter.within('withinTest', (data, _) => {
    state = data
  }, 2000)

  emitter.relay('withinTest', 'pass 1')
  await sleep(1000)
  t.equal(state, 'pass 1', 'should update, is within the timeout')

  emitter.relay('withinTest', 'pass 2')
  await sleep(1000)
  t.equal(state, 'pass 2', 'should update, is within the timeout')

  emitter.relay('withinTest', 'pass 3')
  await sleep(1000)
  t.notEqual(state, 'pass 3', 'should fail to update, is outside the timeout')
}

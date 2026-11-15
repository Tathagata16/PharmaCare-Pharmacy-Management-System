import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/pharmacare-test'

const { default: app } = await import('../src/app.js')
let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})

test('health endpoint reports unavailable until MongoDB connects', async () => {
  const response = await fetch(`${baseUrl}/api/health`)

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    status: 'unavailable',
    database: 'disconnected',
  })
})

test('unknown routes use the centralized not-found response', async () => {
  const response = await fetch(`${baseUrl}/unknown`)

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Route not found' })
})

test('malformed JSON uses the centralized client error response', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })

  assert.equal(response.status, 400)
  assert.equal(typeof (await response.json()).error, 'string')
})

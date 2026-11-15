import assert from 'node:assert/strict'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'
import { after, before, test } from 'node:test'
import { listUsers } from '../src/services/authService.js'

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/pharmacare-test'
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters'

const [{ default: app }, { User }, { env }, { authenticate }, { requirePermission }] =
  await Promise.all([
    import('../src/app.js'),
    import('../src/models/index.js'),
    import('../src/config/env.js'),
    import('../src/middleware/authenticate.js'),
    import('../src/middleware/authorize.js'),
  ])

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

test('user list includes the id field used by user management actions', async () => {
  const originalFind = User.find
  const originalCountDocuments = User.countDocuments
  const userId = '507f1f77bcf86cd799439011'

  User.find = () => ({
    select() { return this },
    sort() { return this },
    skip() { return this },
    limit() { return this },
    lean: async () => [{
      _id: { toString: () => userId },
      name: 'Test Pharmacist',
      email: 'pharmacist@example.test',
      role: 'customer',
      isActive: true,
    }],
  })
  User.countDocuments = async () => 1

  try {
    const result = await listUsers({ page: 1, limit: 50 })
    assert.equal(result.users[0].id, userId)
  } finally {
    User.find = originalFind
    User.countDocuments = originalCountDocuments
  }
})

test('login returns a bearer access token for valid credentials', async () => {
  const originalFindOne = User.findOne
  User.findOne = () => ({
    select: async () => ({
      id: '507f1f77bcf86cd799439011',
      name: 'Test Customer',
      email: 'customer@example.test',
      role: 'customer',
      isActive: true,
      sessionVersion: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      comparePassword: async (password) => password === 'correct-password',
    }),
  })

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'CUSTOMER@example.test', password: 'correct-password' }),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.tokenType, 'Bearer')
    assert.equal(typeof body.accessToken, 'string')
    assert.equal(body.user.email, 'customer@example.test')
    assert.equal(body.user.passwordHash, undefined)
  } finally {
    User.findOne = originalFindOne
  }
})

test('login rejects invalid credentials with a generic response', async () => {
  const originalFindOne = User.findOne
  User.findOne = () => ({ select: async () => null })

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.test', password: 'wrong-password' }),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Invalid email or password' })
  } finally {
    User.findOne = originalFindOne
  }
})

test('authentication middleware rejects expired access tokens', async () => {
  const token = jwt.sign(
    { sub: '507f1f77bcf86cd799439011', sv: 0, exp: Math.floor(Date.now() / 1000) - 10 },
    env.jwtSecret,
  )
  const response = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }

  await authenticate({ get: () => `Bearer ${token}` }, response, () => {
    assert.fail('Expired token must not authenticate')
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { error: 'Invalid or expired access token' })
})

test('customers cannot access internal inventory permissions', () => {
  const response = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }

  requirePermission('inventory:manage')(
    { user: { role: 'customer' } },
    response,
    () => assert.fail('Customer must not be authorized'),
  )

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'Insufficient permissions' })
})

test('authentication routes reject malformed request data', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Customer',
      email: 'not-an-email',
      password: 'short',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'Invalid request')
})

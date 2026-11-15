import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import jwt from 'jsonwebtoken'

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/pharmacare-test'
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters'

const [{ default: app }, { User }, { env }] = await Promise.all([
  import('../src/app.js'),
  import('../src/models/index.js'),
  import('../src/config/env.js'),
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

test('development CORS accepts localhost and loopback Vite origins only', async () => {
  const allowed = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  const rejected = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173')
  assert.equal(rejected.headers.get('access-control-allow-origin'), null)
})

test('medicine and category APIs require authentication', async () => {
  const responses = await Promise.all([
    fetch(`${baseUrl}/api/medicines`),
    fetch(`${baseUrl}/api/categories`),
    fetch(`${baseUrl}/api/medicines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
    fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  ])

  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401])
})

test('customer cannot create medicines or categories', async () => {
  const originalFindById = User.findById
  User.findById = () => ({
    select: async () => ({
      id: '507f1f77bcf86cd799439011',
      role: 'customer',
      isActive: true,
      sessionVersion: 0,
    }),
  })
  const token = jwt.sign(
    { sub: '507f1f77bcf86cd799439011', sv: 0 },
    env.jwtSecret,
    { expiresIn: '1m' },
  )

  try {
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/medicines`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    ])

    assert.deepEqual(responses.map((response) => response.status), [403, 403])
  } finally {
    User.findById = originalFindById
  }
})

test('supplier APIs enforce manager permissions and validate authorized requests', async () => {
  const originalFindById = User.findById
  const tokenForRole = (role) => {
    User.findById = () => ({
      select: async () => ({
        id: '507f1f77bcf86cd799439011',
        role,
        isActive: true,
        sessionVersion: 0,
      }),
    })
    return jwt.sign(
      { sub: '507f1f77bcf86cd799439011', sv: 0 },
      env.jwtSecret,
      { expiresIn: '1m' },
    )
  }

  try {
    const cashierToken = tokenForRole('cashier')
    const denied = await fetch(`${baseUrl}/api/suppliers`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    })
    assert.equal(denied.status, 403)

    const pharmacistToken = tokenForRole('pharmacist')
    const invalidCreate = await fetch(`${baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pharmacistToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Supplier', email: 'invalid', phone: 'bad' }),
    })
    assert.equal(invalidCreate.status, 400)
    assert.equal((await invalidCreate.json()).error, 'Invalid request')

    const invalidActivation = await fetch(
      `${baseUrl}/api/suppliers/507f1f77bcf86cd799439011/activation`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${pharmacistToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: 'false' }),
      },
    )
    assert.equal(invalidActivation.status, 400)
  } finally {
    User.findById = originalFindById
  }
})

test('purchase, sales and inventory APIs enforce roles and validate input', async () => {
  const originalFindById = User.findById
  const tokenForRole = (role) => {
    User.findById = () => ({
      select: async () => ({
        id: '507f1f77bcf86cd799439011',
        role,
        isActive: true,
        sessionVersion: 0,
      }),
    })
    return jwt.sign(
      { sub: '507f1f77bcf86cd799439011', sv: 0 },
      env.jwtSecret,
      { expiresIn: '1m' },
    )
  }

  try {
    const cashierToken = tokenForRole('cashier')
    const cashierPurchase = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    assert.equal(cashierPurchase.status, 403)

    const pharmacistToken = tokenForRole('pharmacist')
    const invalidPurchase = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pharmacistToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        supplier: '507f1f77bcf86cd799439012',
        items: [{
          medicine: '507f1f77bcf86cd799439013',
          batchNumber: 'B1',
          quantity: 0,
          purchasePrice: 1,
          sellingPrice: 2,
          expiryDate: '2099-12-31',
        }],
      }),
    })
    assert.equal(invalidPurchase.status, 400)

    const invalidSale = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: 'sale-request-001',
        items: [{ medicine: '507f1f77bcf86cd799439013', quantity: -1 }],
        paymentMethod: 'cash',
      }),
    })
    assert.equal(invalidSale.status, 400)

    const cashierTokenAfterValidation = tokenForRole('cashier')
    const deniedAdjustment = await fetch(`${baseUrl}/api/inventory/adjustments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierTokenAfterValidation}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    assert.equal(deniedAdjustment.status, 403)

    const deniedReport = await fetch(`${baseUrl}/api/inventory/low-stock`, {
      headers: { Authorization: `Bearer ${cashierTokenAfterValidation}` },
    })
    assert.equal(deniedReport.status, 403)

    const deniedReturn = await fetch(`${baseUrl}/api/returns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierTokenAfterValidation}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    assert.equal(deniedReturn.status, 403)
  } finally {
    User.findById = originalFindById
  }
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

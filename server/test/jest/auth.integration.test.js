import { afterEach, describe, expect, it, jest } from '@jest/globals'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/pharmacare-test'
process.env.JWT_SECRET ??= 'jest-test-secret-that-is-long-enough-32-chars'

const [{ default: app }, { User }, { env }] = await Promise.all([
  import('../../src/app.js'),
  import('../../src/models/index.js'),
  import('../../src/config/env.js'),
])

afterEach(() => jest.restoreAllMocks())

describe('authentication and authorization HTTP behavior', () => {
  it('logs in with valid credentials and omits the password hash', async () => {
    jest.spyOn(User, 'findOne').mockReturnValue({
      select: async () => ({
        id: '507f1f77bcf86cd799439011',
        name: 'Test Pharmacist',
        email: 'pharmacist@example.test',
        role: 'pharmacist',
        isActive: true,
        sessionVersion: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        comparePassword: async (password) => password === 'correct-password',
      }),
    })

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'PHARMACIST@example.test', password: 'correct-password' })

    expect(response.status).toBe(200)
    expect(response.body.tokenType).toBe('Bearer')
    expect(typeof response.body.accessToken).toBe('string')
    expect(response.body.user.email).toBe('pharmacist@example.test')
    expect(response.body.user.passwordHash).toBeUndefined()
  })

  it('rejects invalid credentials without revealing whether the email exists', async () => {
    jest.spyOn(User, 'findOne').mockReturnValue({ select: async () => null })

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@example.test', password: 'wrong-password' })

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Invalid email or password' })
  })

  it('rejects an expired bearer token', async () => {
    const token = jwt.sign(
      { sub: '507f1f77bcf86cd799439011', sv: 0 },
      env.jwtSecret,
      { expiresIn: -1 },
    )

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(401)
    expect(response.body.error).toMatch(/expired/i)
  })

  it('denies a customer access to an inventory adjustment endpoint', async () => {
    jest.spyOn(User, 'findById').mockReturnValue({
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

    const response = await request(app)
      .post('/api/inventory/adjustments')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Insufficient permissions' })
  })

  it('publishes the OpenAPI definition without requiring a session', async () => {
    const response = await request(app).get('/api/docs.json')

    expect(response.status).toBe(200)
    expect(response.body.openapi).toBe('3.0.3')
    expect(response.body.paths['/sales'].post).toBeDefined()
  })

  it('rate limits repeated authentication attempts', async () => {
    jest.spyOn(User, 'findOne').mockReturnValue({ select: async () => null })
    const responses = []
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await request(app)
        .post('/api/auth/login')
        .send({ email: 'rate-limit@example.test', password: 'wrong-password' }))
    }

    expect(responses.some((response) => response.status === 429)).toBe(true)
    expect(responses.at(-1).body.error).toMatch(/too many authentication attempts/i)
  })
})

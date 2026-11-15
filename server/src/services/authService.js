import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/index.js'

function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function issueAccessToken(user) {
  return jwt.sign(
    { sv: user.sessionVersion },
    env.jwtSecret,
    { subject: user.id, expiresIn: env.jwtAccessTokenTtl },
  )
}

export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }
}

export async function registerCustomer({ name, email, password }) {
  const user = new User({ name, email, password, role: 'customer' })

  try {
    await user.save()
  } catch (error) {
    if (error.code === 11000) {
      throw createHttpError(409, 'An account with this email already exists')
    }
    throw error
  }

  return { user, accessToken: issueAccessToken(user) }
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +sessionVersion')
  if (!user || !(await user.comparePassword(password))) {
    throw createHttpError(401, 'Invalid email or password')
  }
  if (!user.isActive) {
    throw createHttpError(403, 'Account is deactivated')
  }

  return { user, accessToken: issueAccessToken(user) }
}

export async function revokeUserSessions(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { sessionVersion: 1 } }, { runValidators: true })
}

export async function listUsers({ page, limit }) {
  const [users, total] = await Promise.all([
    User.find()
      .select('name email role isActive createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(),
  ])
  return { users, total, page, limit }
}

export async function updateUserRole(userId, role) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { role }, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true, projection: 'name email role isActive createdAt' },
  )
  if (!user) throw createHttpError(404, 'User not found')
  return user
}

export async function updateUserActivation(userId, isActive) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { isActive }, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true, projection: 'name email role isActive createdAt' },
  )
  if (!user) throw createHttpError(404, 'User not found')
  return user
}

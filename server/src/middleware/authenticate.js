import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/index.js'

export async function authenticate(req, res, next) {
  const authorization = req.get('authorization')
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)
  if (!match) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  let claims
  try {
    claims = jwt.verify(match[1], env.jwtSecret)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' })
  }

  if (
    typeof claims === 'string' ||
    typeof claims.sub !== 'string' ||
    !Number.isInteger(claims.sv)
  ) {
    return res.status(401).json({ error: 'Invalid access token' })
  }

  try {
    const user = await User.findById(claims.sub).select('+sessionVersion')
    if (!user || !user.isActive || user.sessionVersion !== claims.sv) {
      return res.status(401).json({ error: 'Invalid or revoked access token' })
    }
    req.user = user
    return next()
  } catch (error) {
    return next(error)
  }
}

import {
  listUsers,
  login,
  registerCustomer,
  revokeUserSessions,
  toPublicUser,
  updateUserActivation,
  updateUserRole,
} from '../services/authService.js'

export async function register(req, res) {
  const result = await registerCustomer(req.validated.body)
  res.status(201).json({
    user: toPublicUser(result.user),
    accessToken: result.accessToken,
    tokenType: 'Bearer',
  })
}

export async function loginUser(req, res) {
  const result = await login(req.validated.body)
  res.json({
    user: toPublicUser(result.user),
    accessToken: result.accessToken,
    tokenType: 'Bearer',
  })
}

export async function logout(req, res) {
  await revokeUserSessions(req.user.id)
  res.status(204).end()
}

export function currentUser(req, res) {
  res.json({ user: toPublicUser(req.user) })
}

export async function getUsers(req, res) {
  res.json(await listUsers(req.validated.query))
}

export async function changeUserRole(req, res) {
  if (req.params.userId === req.user.id && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' })
  }
  const user = await updateUserRole(req.params.userId, req.body.role)
  return res.json({ user: toPublicUser(user) })
}

export async function changeUserActivation(req, res) {
  if (req.params.userId === req.user.id && !req.body.isActive) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' })
  }
  const user = await updateUserActivation(req.params.userId, req.body.isActive)
  return res.json({ user: toPublicUser(user) })
}

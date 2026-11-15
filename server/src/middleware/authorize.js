import { rolePermissions } from '../auth/roles.js'

export function requireRoles(...allowedRoles) {
  return function roleAuthorizer(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    return next()
  }
}

export function requirePermission(permission) {
  return function permissionAuthorizer(req, res, next) {
    const permissions = rolePermissions[req.user?.role] ?? []
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    return next()
  }
}

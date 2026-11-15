export const roles = Object.freeze({
  ADMIN: 'admin',
  PHARMACIST: 'pharmacist',
  CASHIER: 'cashier',
  CUSTOMER: 'customer',
})

export const rolePermissions = Object.freeze({
  [roles.ADMIN]: ['*'],
  [roles.PHARMACIST]: [
    'medicine:read',
    'medicine:manage',
    'supplier:read',
    'supplier:manage',
    'inventory:read',
    'inventory:manage',
    'purchase:manage',
    'sales:read:permitted',
    'sales:process',
    'sales:return',
    'reports:inventory',
  ],
  [roles.CASHIER]: [
    'medicine:read',
    'sales:process',
    'sales:read:permitted',
    'invoice:generate',
    'inventory:read',
  ],
  [roles.CUSTOMER]: [
    'medicine:read',
    'sales:read:own',
    'invoice:read:own',
  ],
})

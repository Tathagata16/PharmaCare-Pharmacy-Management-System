import { api } from '../../lib/api.js'

export const authApi = {
  me: () => api.get('/auth/me'),
  listUsers: (params) => api.get('/auth/users', { params }),
  updateRole: (id, role) => api.patch(`/auth/users/${id}/role`, { role }),
  setActive: (id, isActive) => api.patch(`/auth/users/${id}/activation`, { isActive }),
}

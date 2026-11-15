import { api } from '../../lib/api.js'

export const catalogApi = {
  medicines: (params) => api.get('/medicines', { params }),
  createMedicine: (body) => api.post('/medicines', body),
  updateMedicine: (id, body) => api.patch(`/medicines/${id}`, body),
  deleteMedicine: (id) => api.delete(`/medicines/${id}`),
  categories: () => api.get('/categories'),
  createCategory: (body) => api.post('/categories', body),
  updateCategory: (id, body) => api.patch(`/categories/${id}`, body),
  deleteCategory: (id) => api.delete(`/categories/${id}`),
  suppliers: (params) => api.get('/suppliers', { params }),
  createSupplier: (body) => api.post('/suppliers', body),
  updateSupplier: (id, body) => api.patch(`/suppliers/${id}`, body),
  setSupplierActive: (id, isActive) => api.patch(`/suppliers/${id}/activation`, { isActive }),
  supplierPurchases: (id, params) => api.get(`/suppliers/${id}/purchases`, { params }),
}

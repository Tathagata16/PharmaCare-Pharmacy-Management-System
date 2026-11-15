import { api } from '../../lib/api.js'

export const operationsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  salesReport: (params) => api.get('/reports/sales', { params }),
  stockReport: (params) => api.get('/reports/stock', { params }),
  expiryReport: () => api.get('/reports/expiry'),
  supplierReport: (params) => api.get('/reports/suppliers', { params }),
  movements: (params) => api.get('/reports/stock-movements', { params }),
  audits: (params) => api.get('/reports/audit', { params }),
  batches: (params) => api.get('/batches', { params }),
  available: (medicineId) => api.get(`/inventory/available/${medicineId}`),
  lowStock: () => api.get('/inventory/low-stock'),
  nearExpiry: (warningDays = 30) => api.get('/inventory/near-expiry', { params: { warningDays } }),
  valuation: () => api.get('/inventory/valuation'),
  createPurchase: (body) => api.post('/purchases', body),
  purchases: (params) => api.get('/purchases', { params }),
  createSale: (body) => api.post('/sales', body),
  sales: (params) => api.get('/sales', { params }),
  saleInvoice: (saleId) => api.get(`/sales/${saleId}/invoice`),
  createReturn: (body) => api.post('/returns', body),
  returns: (params) => api.get('/returns', { params }),
  adjustStock: (body) => api.post('/inventory/adjustments', body),
}

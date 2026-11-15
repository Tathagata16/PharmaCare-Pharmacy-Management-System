import {
  getAuditHistory,
  getDashboardMetrics,
  getExpiryReport,
  getSalesReport,
  getStockMovementHistory,
  getStockReport,
  getSupplierReport,
} from '../services/reportService.js'

export async function getDashboard(req, res) {
  res.json(await getDashboardMetrics())
}

export async function getSales(req, res) {
  res.json(
    await getSalesReport({
      ...req.validated.query,
      soldBy: req.user.role === 'cashier' ? req.user._id : undefined,
    }),
  )
}

export async function getStock(req, res) {
  res.json(await getStockReport(req.validated.query))
}

export async function getExpiry(req, res) {
  res.json(await getExpiryReport())
}

export async function getSuppliers(req, res) {
  res.json(await getSupplierReport(req.validated.query))
}

export async function getMovements(req, res) {
  res.json(await getStockMovementHistory(req.validated.query))
}

export async function getAudit(req, res) {
  res.json(await getAuditHistory(req.validated.query))
}

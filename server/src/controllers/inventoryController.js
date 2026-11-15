import {
  getAvailableStock,
  getBatchWiseStock,
  getExpiredBatches,
  getLowStockMedicines,
  getNearExpiryBatches,
  getStockValuation,
} from '../services/inventoryService.js'
import { adjustBatchStock } from '../services/stockAdjustmentService.js'

export async function getAvailable(req, res) {
  const quantity = await getAvailableStock(req.validated.params.medicineId)
  res.json({ medicine: req.validated.params.medicineId, availableStock: quantity })
}

export async function getBatchWise(req, res) {
  res.json(await getBatchWiseStock(req.validated.params.medicineId))
}

export async function getLowStock(req, res) {
  res.json({ medicines: await getLowStockMedicines() })
}

export async function getNearExpiry(req, res) {
  res.json({ batches: await getNearExpiryBatches(req.validated.query.warningDays) })
}

export async function getExpired(req, res) {
  res.json({ batches: await getExpiredBatches() })
}

export async function getValuation(req, res) {
  res.json(await getStockValuation())
}

export async function postAdjustment(req, res) {
  const movement = await adjustBatchStock({
    ...req.validated.body,
    performedBy: req.user._id,
  })
  res.status(201).json({ stockMovement: movement })
}

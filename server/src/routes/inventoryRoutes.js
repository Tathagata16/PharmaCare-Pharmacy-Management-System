import { Router } from 'express'
import {
  getAvailable,
  getBatchWise,
  getExpired,
  getLowStock,
  getNearExpiry,
  getValuation,
  postAdjustment,
} from '../controllers/inventoryController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  inventoryAlertSchema,
  medicineStockSchema,
  stockAdjustmentSchema,
} from '../validators/inventoryValidators.js'

const router = Router()
router.use(authenticate)

router.get('/available/:medicineId', requirePermission('inventory:read'), validateRequest(medicineStockSchema), getAvailable)
router.get('/batch-wise/:medicineId', requirePermission('inventory:read'), validateRequest(medicineStockSchema), getBatchWise)
router.get('/low-stock', requirePermission('reports:inventory'), getLowStock)
router.get('/near-expiry', requirePermission('reports:inventory'), validateRequest(inventoryAlertSchema), getNearExpiry)
router.get('/expired', requirePermission('reports:inventory'), getExpired)
router.get('/valuation', requirePermission('reports:inventory'), getValuation)
router.post('/adjustments', requirePermission('inventory:manage'), validateRequest(stockAdjustmentSchema), postAdjustment)

export default router

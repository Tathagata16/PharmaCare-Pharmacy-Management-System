import { Router } from 'express'
import {
  getAudit,
  getDashboard,
  getExpiry,
  getMovements,
  getSales,
  getStock,
  getSuppliers,
} from '../controllers/reportController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission, requireRoles } from '../middleware/authorize.js'
import { roles } from '../auth/roles.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  movementHistorySchema,
  salesReportSchema,
  stockReportSchema,
  supplierReportSchema,
} from '../validators/reportValidators.js'
import { z } from 'zod'

const pageQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).strict(),
})

const router = Router()
router.use(authenticate)

router.get('/dashboard', requireRoles(roles.ADMIN, roles.PHARMACIST), getDashboard)
router.get(
  '/sales',
  requireRoles(roles.ADMIN, roles.PHARMACIST, roles.CASHIER),
  validateRequest(salesReportSchema),
  getSales,
)
router.get(
  '/stock',
  requirePermission('reports:inventory'),
  validateRequest(stockReportSchema),
  getStock,
)
router.get('/expiry', requirePermission('reports:inventory'), getExpiry)
router.get(
  '/suppliers',
  requirePermission('reports:inventory'),
  validateRequest(supplierReportSchema),
  getSuppliers,
)
router.get(
  '/stock-movements',
  requirePermission('inventory:read'),
  validateRequest(movementHistorySchema),
  getMovements,
)
router.get(
  '/audit',
  requireRoles(roles.ADMIN),
  validateRequest(pageQuerySchema),
  getAudit,
)

export default router

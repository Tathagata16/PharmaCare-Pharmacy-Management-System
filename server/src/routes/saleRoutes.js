import { Router } from 'express'
import {
  getSale,
  getSaleInvoice,
  getPrintableSaleInvoice,
  getSales,
  postSale,
} from '../controllers/saleController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { saleCreateSchema, saleIdSchema, saleListSchema } from '../validators/saleValidators.js'

const router = Router()
router.use(authenticate)

router.post('/', requirePermission('sales:process'), validateRequest(saleCreateSchema), postSale)
router.get('/', requirePermission('sales:read:permitted'), validateRequest(saleListSchema), getSales)
router.get(
  '/:saleId/invoice/print',
  requirePermission('invoice:generate'),
  validateRequest(saleIdSchema),
  getPrintableSaleInvoice,
)
router.get(
  '/:saleId/invoice',
  requirePermission('invoice:generate'),
  validateRequest(saleIdSchema),
  getSaleInvoice,
)
router.get('/:saleId', requirePermission('sales:read:permitted'), validateRequest(saleIdSchema), getSale)

export default router

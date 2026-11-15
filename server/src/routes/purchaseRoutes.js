import { Router } from 'express'
import {
  getPurchase,
  getPurchases,
  postPurchase,
} from '../controllers/purchaseController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  purchaseCreateSchema,
  purchaseIdSchema,
  purchaseListSchema,
} from '../validators/purchaseValidators.js'

const router = Router()
router.use(authenticate, requirePermission('purchase:manage'))

router.post('/', validateRequest(purchaseCreateSchema), postPurchase)
router.get('/', validateRequest(purchaseListSchema), getPurchases)
router.get('/:purchaseId', validateRequest(purchaseIdSchema), getPurchase)

export default router

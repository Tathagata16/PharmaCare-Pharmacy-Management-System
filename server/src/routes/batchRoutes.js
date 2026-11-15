import { Router } from 'express'
import { getBatches } from '../controllers/batchController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { batchListSchema } from '../validators/purchaseValidators.js'

const router = Router()
router.use(authenticate, requirePermission('inventory:manage'))
router.get('/', validateRequest(batchListSchema), getBatches)

export default router

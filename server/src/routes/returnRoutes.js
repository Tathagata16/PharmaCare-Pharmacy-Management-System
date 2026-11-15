import { Router } from 'express'
import { getReturns, postReturn } from '../controllers/returnController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { returnCreateSchema, returnListSchema } from '../validators/returnValidators.js'

const router = Router()
router.use(authenticate, requirePermission('sales:return'))

router.post('/', validateRequest(returnCreateSchema), postReturn)
router.get('/', validateRequest(returnListSchema), getReturns)

export default router

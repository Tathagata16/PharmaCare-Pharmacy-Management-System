import { Router } from 'express'
import {
  getMedicine,
  getMedicines,
  patchMedicine,
  postMedicine,
  removeMedicine,
} from '../controllers/medicineController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  medicineCreateSchema,
  medicineIdSchema,
  medicineListSchema,
  medicineUpdateSchema,
} from '../validators/catalogValidators.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('medicine:read'), validateRequest(medicineListSchema), getMedicines)
router.get(
  '/:medicineId',
  requirePermission('medicine:read'),
  validateRequest(medicineIdSchema),
  getMedicine,
)
router.post(
  '/',
  requirePermission('medicine:manage'),
  validateRequest(medicineCreateSchema),
  postMedicine,
)
router.patch(
  '/:medicineId',
  requirePermission('medicine:manage'),
  validateRequest(medicineUpdateSchema),
  patchMedicine,
)
router.delete(
  '/:medicineId',
  requirePermission('medicine:manage'),
  validateRequest(medicineIdSchema),
  removeMedicine,
)

export default router

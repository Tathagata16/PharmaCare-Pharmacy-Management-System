import { Router } from 'express'
import {
  getCategories,
  patchCategory,
  postCategory,
  removeCategory,
} from '../controllers/categoryController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  categoryCreateSchema,
  categoryIdSchema,
  categoryUpdateSchema,
} from '../validators/catalogValidators.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('medicine:read'), getCategories)
router.post(
  '/',
  requirePermission('medicine:manage'),
  validateRequest(categoryCreateSchema),
  postCategory,
)
router.patch(
  '/:categoryId',
  requirePermission('medicine:manage'),
  validateRequest(categoryUpdateSchema),
  patchCategory,
)
router.delete(
  '/:categoryId',
  requirePermission('medicine:manage'),
  validateRequest(categoryIdSchema),
  removeCategory,
)

export default router

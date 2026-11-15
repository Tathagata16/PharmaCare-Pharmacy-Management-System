import { Router } from 'express'
import {
  getSupplier,
  getSupplierPurchases,
  getSuppliers,
  patchSupplier,
  patchSupplierActivation,
  postSupplier,
} from '../controllers/supplierController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requirePermission } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  supplierActivationSchema,
  supplierCreateSchema,
  supplierIdSchema,
  supplierListSchema,
  supplierPurchaseHistorySchema,
  supplierUpdateSchema,
} from '../validators/supplierValidators.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('supplier:read'), validateRequest(supplierListSchema), getSuppliers)
router.post(
  '/',
  requirePermission('supplier:manage'),
  validateRequest(supplierCreateSchema),
  postSupplier,
)
router.get(
  '/:supplierId/purchases',
  requirePermission('supplier:read'),
  validateRequest(supplierPurchaseHistorySchema),
  getSupplierPurchases,
)
router.patch(
  '/:supplierId/activation',
  requirePermission('supplier:manage'),
  validateRequest(supplierActivationSchema),
  patchSupplierActivation,
)
router.get(
  '/:supplierId',
  requirePermission('supplier:read'),
  validateRequest(supplierIdSchema),
  getSupplier,
)
router.patch(
  '/:supplierId',
  requirePermission('supplier:manage'),
  validateRequest(supplierUpdateSchema),
  patchSupplier,
)

export default router

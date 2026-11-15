import { Router } from 'express'
import {
  changeUserActivation,
  changeUserRole,
  currentUser,
  getUsers,
  loginUser,
  logout,
  register,
} from '../controllers/authController.js'
import { roles } from '../auth/roles.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireRoles } from '../middleware/authorize.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { authRateLimit } from '../middleware/authRateLimit.js'
import {
  loginSchema,
  registerSchema,
  userActivationSchema,
  userIdSchema,
  userListSchema,
  userRoleSchema,
} from '../validators/authValidators.js'

const router = Router()

router.post('/register', authRateLimit, validateRequest(registerSchema), register)
router.post('/login', authRateLimit, validateRequest(loginSchema), loginUser)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, currentUser)

router.use('/users', authenticate, requireRoles(roles.ADMIN))
router.get('/users', validateRequest(userListSchema), getUsers)
router.patch('/users/:userId/role', validateRequest(userRoleSchema), changeUserRole)
router.patch(
  '/users/:userId/activation',
  validateRequest(userActivationSchema),
  changeUserActivation,
)

export default router

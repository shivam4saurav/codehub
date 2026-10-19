import { Router } from 'express';

import {
  login,
  logout,
  me,
  refresh,
  register,
  updatePassword,
} from '../controllers/auth.controller.js';
import authenticate from '../middleware/authenticate.js';
import { authLimiter, loginAccountLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', registerLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, loginAccountLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.patch(
  '/password',
  authLimiter,
  authenticate,
  validate({ body: changePasswordSchema }),
  updatePassword,
);

export default router;

import { Router } from 'express';

import { updateMe } from '../controllers/user.controller.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/auth.validators.js';

const router = Router();

router.patch('/me', authenticate, validate({ body: updateProfileSchema }), updateMe);

export default router;

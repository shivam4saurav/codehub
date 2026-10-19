import { Router } from 'express';

import authRoutes from './auth.routes.js';
import contestRoutes from './contest.routes.js';
import handleRoutes from './handle.routes.js';
import healthRoutes from './health.routes.js';
import reminderRoutes from './reminder.routes.js';
import problemRoutes from './problem.routes.js';
import profileRoutes from './profile.routes.js';
import publicProfileRoutes from './publicProfile.routes.js';
import recommendationRoutes from './recommendation.routes.js';
import taxonomyRoutes from './taxonomy.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/taxonomy', taxonomyRoutes);
router.use('/handles', handleRoutes);
router.use('/problems', problemRoutes);
router.use('/profile', profileRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/contests', contestRoutes);
router.use('/reminders', reminderRoutes);

// Mounted at the /api root: /api/public/:username and /api/card/:username.png
router.use('/', publicProfileRoutes);

export default router;

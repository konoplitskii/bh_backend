import { Router } from 'express';
import { profileUser } from '../controllers/usersController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/me', authenticateToken, profileUser);

export default router;

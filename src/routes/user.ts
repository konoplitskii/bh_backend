import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { profileUser } from '../controllers/usersController';

const router = Router();

router.get('/me', authenticateToken, profileUser);

export default router;

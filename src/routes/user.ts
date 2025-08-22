import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getUsers, profileUser } from '../controllers/usersController';

const router = Router();

router.get('/me', authenticateToken, profileUser);
router.get('/users', authenticateToken, getUsers);

export default router;

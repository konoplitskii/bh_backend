import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { createBug, getBug, deleteBug, updateBug, getTaskBugs } from '../controllers/bugController';

const router = Router();

router.get('/bug/:id', authenticateToken, getBug);
router.post('/bug', authenticateToken, createBug);
router.delete('/bug/:id', authenticateToken, deleteBug);
router.put('/bug/:id', authenticateToken, updateBug);
router.get('/task/:id/bugs', authenticateToken, getTaskBugs);

export default router;

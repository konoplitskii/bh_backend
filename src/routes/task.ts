import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { createTask, deleteTask, getTasks, getTask, updateTask, hideTask, unhideTask } from '../controllers/taskController';

const router = Router();

router.get('/task/:id', authenticateToken, getTask);
router.get('/task', authenticateToken, getTasks);
router.post('/task', authenticateToken, createTask);
router.delete('/task/:id', authenticateToken, deleteTask);
router.put('/task/:id', authenticateToken, updateTask);
router.post('/task/:id/hide', authenticateToken, hideTask);
router.delete('/task/:id/hide', authenticateToken, unhideTask);

export default router;

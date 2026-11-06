import { Router } from 'express';
import {
  assignRoutine,
  createRoutine,
  deleteRoutine,
  getAssignments,
  getRoutines,
  getTrainers,
  getWorkoutClients,
  updateAssignmentStatus,
  updateRoutine,
} from '../controllers/workout.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireTrainerOrAdmin } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate, requireTrainerOrAdmin);

router.get('/clients', getWorkoutClients);
router.get('/trainers', getTrainers);
router.get('/routines', getRoutines);
router.post('/routines', createRoutine);
router.put('/routines/:id', updateRoutine);
router.delete('/routines/:id', deleteRoutine);
router.get('/assignments', getAssignments);
router.post('/assignments', assignRoutine);
router.patch('/assignments/:id/status', updateAssignmentStatus);

export default router;

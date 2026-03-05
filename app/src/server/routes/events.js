import { Router } from 'express';
import { verifyToken } from '../handlers/auth.js';
import { performCreateNewEvent, performDeleteEvent, performGetAllEvents, performUpdateEvent } from '../handlers/events.js';

const router = Router();

router.get('/', verifyToken, performGetAllEvents);

router.post('/', verifyToken, performCreateNewEvent);

router.put('/:id', verifyToken, performUpdateEvent);

router.delete('/:id', verifyToken, performDeleteEvent);

export default router;



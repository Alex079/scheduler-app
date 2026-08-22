import { Router } from 'express';
import { performLogin } from '../handlers/auth.js';

const router = Router();

router.post('/login', performLogin);

export default router;

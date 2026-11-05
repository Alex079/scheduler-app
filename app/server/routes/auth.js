import { Router } from 'express';
import { performLogin, loginRateLimit } from '../handlers/auth.js';

const router = Router();

router.post('/login', loginRateLimit, performLogin);

export default router;

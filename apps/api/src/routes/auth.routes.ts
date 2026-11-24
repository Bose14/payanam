import { Router } from 'express';
import {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  phoneRequest,
  phoneVerify,
  onboarding,
  exportMe,
  deleteMe,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/phone/request', phoneRequest);
router.post('/phone/verify', phoneVerify);
router.post('/onboarding', authMiddleware, onboarding);
router.get('/me', authMiddleware, getMe);
router.get('/me/export', authMiddleware, exportMe);
router.delete('/me', authMiddleware, deleteMe);
router.post('/logout', authMiddleware, logout);

export default router;

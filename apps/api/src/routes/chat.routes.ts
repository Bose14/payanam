import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as c from '../controllers/chat.controller';

const router = Router();
router.use(authMiddleware);

router.get('/conversations', c.listConversations);
router.get('/unread', c.unread);
router.get('/contacts', c.contacts);

// The conversation key (trip:<id>, group:<id>, dm:<a>:<b>) travels in ?key= so it can contain colons.
router.get('/messages', c.messages);
router.post('/messages', c.send);
router.post('/messages/:messageId/confirm-stop', c.confirmStop);

router.put('/messages/:messageId/live', c.updateLive);
router.post('/messages/:messageId/stop-live', c.stopLive);

router.post('/groups', c.createGroup);
router.post('/groups/join', c.joinGroup);
router.get('/groups/:id', c.getGroup);
router.put('/groups/:id/requests/:userId', c.respondGroup);

export default router;

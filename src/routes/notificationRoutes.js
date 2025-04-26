import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/notifications', authenticate, getUserNotifications);
router.patch('/notifications/:id', authenticate, markNotificationAsRead);
router.patch('/notifications', authenticate, markAllNotificationsAsRead);
router.delete('/notifications/:id', authenticate, deleteNotification);
router.delete('/notifications', authenticate, deleteAllNotifications);

export default router;

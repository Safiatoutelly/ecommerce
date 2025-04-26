import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  toggleLike,
  toggleDislike,
  getProductLikes,
  getUserReaction
} from '../controllers/likeController.js';

const router = express.Router();

// Routes pour les likes
router.post('/products/:productId/like', authenticate, toggleLike);
router.post('/products/:productId/dislike', authenticate, toggleDislike);
router.get('/products/:productId/likes', getProductLikes);
router.get('/products/:productId/user-reaction', authenticate, getUserReaction);

export default router;
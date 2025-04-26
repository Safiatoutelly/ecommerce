import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  addComment,
  getProductComments,
  replyToComment,
  deleteComment,
  deleteReply,
  updateComment
} from '../controllers/commentController.js';

const router = express.Router();

// Routes pour les commentaires
router.post('/products/:productId/comments', authenticate, addComment);
router.get('/products/:productId/comments', getProductComments);
router.post('/comments/:commentId/replies', authenticate, replyToComment);
router.delete('/comments/:commentId', authenticate, deleteComment);
router.delete('/replies/:replyId', authenticate, deleteReply);
router.put('/comments/:commentId', authenticate, updateComment);

export default router;
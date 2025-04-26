import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { 
    toggleFollow, 
  getUserFollowers, 
  getUserFollowing,
  checkIfFollowing,
  getSuggestedUsers
} from '../controllers/subscriptionController.js';

const router = express.Router();

// Suivre/Ne plus suivre un utilisateur (toggle)
router.post('/users/:userId/toggle-follow', authenticate, toggleFollow);

router.get('/users/:userId/followers', getUserFollowers);

router.get('/users/:userId/following', getUserFollowing);

router.get('/users/:userId/isFollowing', authenticate, checkIfFollowing);

router.get('/users/suggestions', authenticate, getSuggestedUsers);

export default router;
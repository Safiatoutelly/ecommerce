import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getMerchantOrders,
  checkOrderConfirmation,
  requestMerchantFeedback
} from '../controllers/orderController.js';

const router = express.Router();

// Routes pour les commandes (client)
router.get('/orders', authenticate, getOrders);
router.get('/orders/:orderId', authenticate, getOrderById);
router.get('/orders/:orderId/check-confirmation', authenticate, checkOrderConfirmation);
router.get('/orders/:orderId/request-feedback', authenticate, requestMerchantFeedback);

// Routes pour les commandes (marchand)
router.get('/merchant/orders', authenticate, getMerchantOrders);
router.patch('/orders/:orderId/status', authenticate, updateOrderStatus);

export default router;
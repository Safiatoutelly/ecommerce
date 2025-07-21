import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getMerchantOrders,
  checkOrderConfirmation,
  requestMerchantFeedback,
  autoConfirmDelivery,
  sendOrderReminder,
  cleanupOldCanceledOrders,
  deleteOrder,
  getTopProducts,
  getMerchantStats, 
  getRevenueChart,
  checkOrderConfirmationImproved, // 🆕 NOUVELLE MÉTHODE
  getOrderMerchants,              // 🆕 NOUVELLE MÉTHODE
  sendPersonalizedMerchantReminder,    // 🆕 Rappel personnalisé pour un marchand
  sendSelectedMerchantsReminder,       // 🆕 Rappel pour plusieurs marchands sélectionnés
  getOrderMerchantsWithProducts,       // 🆕 Détails des marchands avec leurs produits
} from '../controllers/orderController.js';

const router = express.Router();

// Routes pour les commandes (client)
router.get('/orders', authenticate, getOrders);
router.get('/orders/:orderId', authenticate, getOrderById);
router.get('/orders/:orderId/check-confirmation', authenticate, checkOrderConfirmation);
router.post('/orders/:orderId/send-reminder', authenticate, sendOrderReminder); 
router.get('/orders/:orderId/request-feedback', authenticate, requestMerchantFeedback);
router.delete('/orders/:orderId', authenticate, deleteOrder);


// Routes pour les commandes (marchand)
router.get('/orders/:orderId/merchants', authenticate, getOrderMerchants);
router.get('/orders/:orderId/check-confirmation-v2', authenticate, checkOrderConfirmationImproved);
router.get('/merchant/orders', authenticate, getMerchantOrders);
router.patch('/orders/:orderId/status', authenticate, updateOrderStatus);
router.post('/orders/auto-confirm-deliveries', authenticate, autoConfirmDelivery);
router.get('/merchant/stats', authenticate, getMerchantStats);           // 📊 Stats complètes
router.get('/merchant/revenue-chart', authenticate, getRevenueChart);   // 📈 Graphique
router.get('/merchant/top-products', authenticate, getTopProducts);     // 🏆 Top produits (déjà présent)
// 🆕 ROUTE ADMIN: Nettoyer les anciennes commandes annulées
router.post('/orders/cleanup-canceled', authenticate, cleanupOldCanceledOrders);
// 🆕 =============== NOUVELLES ROUTES À AJOUTER ===============

// 1. Rappel personnalisé pour un marchand spécifique
router.post('/orders/:orderId/remind-merchant/:merchantId', 
  authenticate, 
  sendPersonalizedMerchantReminder
);

// 2. Rappel pour plusieurs marchands sélectionnés
router.post('/orders/:orderId/remind-selected-merchants', 
  authenticate, 
  sendSelectedMerchantsReminder
);

// 3. Obtenir les détails des marchands avec leurs produits
router.get('/orders/:orderId/merchants-details', 
  authenticate, 
  getOrderMerchantsWithProducts
);

export default router;
import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  shareCartViaWhatsApp,
  createOrderFromCart
} from '../controllers/panierController.js';

const router = express.Router();


router.post('/cart', authenticate, addToCart);
// Créer une commande à partir du panier
router.post('/cart/order', authenticate, createOrderFromCart);

router.get('/cart', authenticate, getCart);


router.put('/cart/items/:itemId', authenticate, updateCartItem);

// Supprimer un article du panier
router.delete('/cart/items/:itemId', authenticate, removeFromCart);

// Vider le panier
router.delete('/cart', authenticate, clearCart);

// Partager le panier via WhatsApp
router.post('/cart/share/whatsapp', authenticate, shareCartViaWhatsApp);

export default router;
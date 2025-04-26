import express from 'express';
import {
  createShop,
  getShopById,
  getAllShops,
  updateShop,
  getMyShop,
  getShopProducts,
  deleteShop,
  getShopWithMerchantDetails,
  contactMerchant,
  getAllUserMessages
  
} from '../controllers/shopController.js';
import { authenticate, isMerchant } from '../middlewares/authMiddleware.js';
import upload from '../utils/multerConfig.js';
import { authenticateToken } from '../controllers/auth/authController.js';


const router = express.Router();

// Création d'une boutique
router.post('/', authenticate, isMerchant, upload.single('logo'), createShop);

// Récupérer toutes les boutiques
router.get('/', getAllShops);

// Récupérer ma boutique (utilisateur connecté)
router.get('/my-shop', authenticate, isMerchant, getMyShop);

// Récupérer les produits d'une boutique spécifique
router.get('/:shopId/products', getShopProducts);

// Récupérer une boutique par son ID
router.get('/:id', getShopById);

// Mettre à jour une boutique
router.put('/:id', authenticate, isMerchant, upload.single('logo'), updateShop);

// Supprimer une boutique
router.delete('/:id', authenticate, isMerchant, deleteShop);
// Routes publiques pour les clients
router.get('/:id/details', getShopWithMerchantDetails);  // Pour voir les détails d'une boutique
router.post('/:shopId/contact',authenticateToken,  contactMerchant);
// Dans votre fichier de routes
router.get('/dashboard/messages', authenticateToken, getAllUserMessages);      // Pour contacter un commerçant

// Route pour la gestion des messages côté commerçant (à créer)

export default router;
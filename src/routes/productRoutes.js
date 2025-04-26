import express from 'express';
import { 
  createProduct, 
  getAllProducts, 
  getProductById, 
  updateProduct, 
  deleteProduct, 
  updateProductStock,
  getMerchantProducts,
  searchProducts,
  getProductsByCategory,
  getLatestProducts,
  getProductCategories,
  getFeaturedProducts,
  getProductStats,
  getRelatedProducts
} from '../controllers/ProductController.js';
import { authenticate, isMerchant } from '../middlewares/authMiddleware.js';
import upload from '../utils/multer.js';

const router = express.Router();

// Routes publiques
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/latest', getLatestProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getProductCategories);
router.get('/merchant/:merchantId', getMerchantProducts);

router.get('/:id/related', getRelatedProducts);
router.get('/:id', getProductById);


router.post('/', 
  authenticate, 
  isMerchant, 
  upload.uploadProductMedia, 
  upload.checkFileSizeLimits, 
  createProduct
);
router.put('/:id', authenticate, upload.uploadProductMedia, upload.checkFileSizeLimits, updateProduct);
router.patch('/:id/stock', authenticate, updateProductStock);
router.delete('/:id', authenticate, deleteProduct);
router.get('/stats', authenticate, isMerchant, getProductStats);

export default router;

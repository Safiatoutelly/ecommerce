import express from 'express';
import { registerUser, verifyCodeAndCompleteRegistration,loginUser,
    forgotPassword,
    resetPassword,
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteUserAccount,
    verifyToken,
    getAllUsers,
    updateUserRole,
    resendVerificationCode,
    checkVerificationStatus,
    authenticateToken,
    isAdmin,
    completePersonalInfo,
  completeContactInfo,
  completeAddressInfo,
  completeProfilePhoto,
  skipOnboardingStep,
  getOnboardingStatus,
    logoutUser  } from '../../controllers/auth/authController.js';
    import upload from '../../utils/multerConfig.js';


const router = express.Router();

// Route pour l'inscription
router.post('/register', upload.single('photo'), registerUser);

// Route pour la vérification du code et finalisation de l'inscription
router.post('/verify', verifyCodeAndCompleteRegistration);
// Routes publiques

router.post('/verify', verifyCodeAndCompleteRegistration);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerificationCode);
router.post('/check-verification', checkVerificationStatus);

// Routes protégées
router.get('/profile', authenticateToken, getUserProfile);
router.put('/profile', authenticateToken, upload.single('photo'), updateUserProfile);

router.put('/change-password', authenticateToken, changePassword);
router.delete('/account', authenticateToken, deleteUserAccount);
router.post('/logout', authenticateToken, logoutUser);
router.get('/verify-token', authenticateToken, verifyToken);

// Routes admin
router.get('/all', authenticateToken, isAdmin, getAllUsers);
router.put('/role', authenticateToken, isAdmin, updateUserRole);
// ===============================================
// 🆕 NOUVELLES ROUTES ONBOARDING PROGRESSIF
// ===============================================

// 📊 Obtenir le statut d'onboarding de l'utilisateur connecté
router.get('/onboarding/status', authenticateToken, getOnboardingStatus);

// 👤 Étape 2: Compléter les informations personnelles (nom, prénom, genre, date naissance)
router.post('/onboarding/personal', authenticateToken, completePersonalInfo);

// 📱 Étape 3: Compléter les informations de contact (téléphone, WhatsApp)
router.post('/onboarding/contact', authenticateToken, completeContactInfo);

// 📍 Étape 4: Compléter l'adresse (pays, ville, département, commune, adresse complète)
router.post('/onboarding/address', authenticateToken, completeAddressInfo);

// 📸 Étape 5: Ajouter une photo de profil (optionnelle)
router.post('/onboarding/photo', authenticateToken, upload.single('photo'), completeProfilePhoto);

// ⏭️ Ignorer une étape d'onboarding (pour les étapes optionnelles)
router.post('/onboarding/skip', authenticateToken, skipOnboardingStep);
export default router;

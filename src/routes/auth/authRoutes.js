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

export default router;

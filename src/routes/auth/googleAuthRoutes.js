import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { updateProfile, getProfile, uploadProfilePhoto } from '../../controllers/auth/userController.js';

const router = express.Router();

// Route d'authentification Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback après authentification Google
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    try {
      const user = req.user;
      console.log('Utilisateur authentifié:', user.id);

      // URL du frontend (à définir dans vos variables d'environnement)
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      // Générer le token JWT avec une durée de validité plus longue
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          needsCompletion: req.authInfo?.needsCompletion || false
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' } // Augmenté à 7 jours
      );
      
      console.log('Token généré avec succès, premiers caractères:', token.substring(0, 15));

      // Si le profil nécessite une complétion
      if (req.authInfo?.needsCompletion) {
        console.log('Redirection vers la page de complétion du profil');
        return res.redirect(`${frontendURL}/complete-profile?token=${token}`);
      }

      // Sinon, rediriger vers le tableau de bord
      console.log('Redirection vers la page d\'accueil/dashboard');
      return res.redirect(`${frontendURL}/dashboard?token=${token}`);
    } catch (error) {
      console.error('Erreur dans le callback Google:', error);
      res.status(500).json({ message: 'Erreur serveur dans le callback Google' });
    }
  }
);

// Récupérer le profil utilisateur
router.get('/profile', authenticate, getProfile);

// Mettre à jour le profil utilisateur
router.put('/profile1', authenticate, updateProfile);

// Télécharger une photo de profil
router.post('/upload-photo', authenticate, uploadProfilePhoto);

// Vérifier l'état du token
router.get('/verify-token', authenticate, (req, res) => {
  res.status(200).json({ 
    isValid: true, 
    user: { 
      id: req.user.id, 
      email: req.user.email,
      needsCompletion: req.user.needsCompletion
    } 
  });
});

export default router;
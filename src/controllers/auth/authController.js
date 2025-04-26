import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../../services/emailService.js';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Fonction pour générer un code de vérification
const generateVerificationCode = () => {
  return crypto.randomBytes(3).toString('hex'); // Code de 6 caractères
};

// Fonction pour l'inscription
// Fonction pour l'inscription
export const registerUser = async (req, res) => {
  const { email, firstName, lastName, phoneNumber, password, country, city, department, commune, role } = req.body;
  const photo = req.file ? req.file.path : null; // Récupérer le chemin de la photo

  try {
    // Vérifier si le numéro de téléphone existe déjà
    const existingPhoneUser = await prisma.user.findUnique({
      where: { phoneNumber }
    });
    
    if (existingPhoneUser) {
      if (existingPhoneUser.verificationCode === '1') {
        // Si le code est 1, refuser l'inscription
        return res.status(400).json({ 
          message: "Ce numéro de téléphone est déjà utilisé par un autre compte" 
        });
      } else {
        // Si le code n'est pas 1, supprimer l'ancien utilisateur
        await prisma.user.delete({
          where: { id: existingPhoneUser.id }
        });
      }
    }

    // Vérifier si l'email existe déjà
    const existingEmailUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingEmailUser) {
      if (existingEmailUser.verificationCode === '1') {
        // Si le code est 1, refuser l'inscription
        return res.status(400).json({ 
          message: "Cette adresse email est déjà utilisée par un autre compte" 
        });
      } else {
        // Si le code n'est pas 1, supprimer l'ancien utilisateur
        await prisma.user.delete({
          where: { id: existingEmailUser.id }
        });
      }
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Générer un code de vérification
    const verificationCode = generateVerificationCode();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    // Convertir le rôle pour s'assurer qu'il est accepté par Prisma
    let userRole;
    if (role === 'CLIENT' || role === 'MERCHANT' || role === 'SUPPLIER') {
      userRole = role;
    } else {
      // Valeur par défaut si le rôle n'est pas reconnu
      userRole = 'MERCHANT';
    }

    // Création de l'utilisateur avec le rôle converti
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phoneNumber,
        password: hashedPassword,
        country,
        city,
        department,
        commune,
        photo,
        role: userRole, // Utiliser le rôle converti
        verificationCode,
        tokenExpiry,
        isVerified: false,
      },
    });

    // Envoyer l'email de vérification
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({
      message: "Un code de vérification a été envoyé à votre email. Veuillez le saisir pour terminer votre inscription.",
      email: email
    });
  } catch (error) {
    console.error('Erreur d\'inscription:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription', error: error.message });
  }
};


// Fonction pour vérifier le code et finaliser l'inscription
export const verifyCodeAndCompleteRegistration = async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email requis pour la vérification.' });
    }

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier si le code a expiré
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return res.status(400).json({ message: 'Code de vérification expiré. Veuillez vous réinscrire.' });
    }

    // Vérifier si le code de vérification est correct
    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ message: 'Code de vérification incorrect' });
    }

  

    // Mettre à jour l'utilisateur comme vérifié et définir son mot de passe
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        verificationCode: null,
        tokenExpiry: null
      },
    });

    // Envoyer un email de bienvenue
    await sendWelcomeEmail(updatedUser.email, updatedUser.firstName);

    res.status(200).json({ 
      message: 'Inscription terminée, bienvenue!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la vérification du code et de la finalisation de l\'inscription', error: error.message });
  }
};

// Fonction de connexion
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Trouver l'utilisateur par email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Si l'utilisateur n'existe pas
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Si l'utilisateur n'est pas vérifié
    if (!user.isVerified) {
      // Générer un nouveau code de vérification
      const verificationCode = generateVerificationCode();
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

      await prisma.user.update({
        where: { email },
        data: { 
          verificationCode,
          tokenExpiry
        },
      });

      // Envoyer un nouvel email de vérification
      await sendVerificationEmail(email, verificationCode);

      return res.status(403).json({ 
        message: 'Votre compte n\'est pas vérifié. Un nouveau code de vérification a été envoyé à votre email.',
        needsVerification: true,
        email: email
      });
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};

// Fonction pour mot de passe oublié - envoi de code
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'Aucun compte n\'est associé à cet email' });
    }

    // Générer un code de réinitialisation
    const resetCode = generateVerificationCode();
    const tokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 heure

    // Mettre à jour l'utilisateur avec le code de réinitialisation
    await prisma.user.update({
      where: { email },
      data: {
        resetCode,
        tokenExpiry
      },
    });

    // Envoyer l'email avec le code de réinitialisation
    await sendPasswordResetEmail(email, resetCode);

    res.status(200).json({
      message: 'Un code de réinitialisation a été envoyé à votre adresse email.',
      email: email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du code de réinitialisation', error: error.message });
  }
};

// Fonction pour réinitialiser le mot de passe avec le code
export const resetPassword = async (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier si le code a expiré
    if (!user.tokenExpiry || new Date() > user.tokenExpiry) {
      return res.status(400).json({ message: 'Code de réinitialisation expiré' });
    }

    // Vérifier si le code de réinitialisation est correct
    if (user.resetCode !== resetCode) {
      return res.status(400).json({ message: 'Code de réinitialisation incorrect' });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe et supprimer le code de réinitialisation
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetCode: null,
        tokenExpiry: null
      },
    });

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe', error: error.message });
  }
};

// Fonction pour obtenir le profil utilisateur
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // Obtenu du middleware d'authentification

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        country: true,
        city: true,
        department: true,
        commune: true,
        photo: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // Ne pas inclure le mot de passe et les codes
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération du profil', error: error.message });
  }
};

// Fonction pour mettre à jour le profil utilisateurexport const updateUserProfile = async (req, res) => {
  export const updateUserProfile = async (req, res) => {
    const { firstName, lastName, phoneNumber, country, city, department, commune } = req.body;
    const userId = req.user.userId; // Obtenu du middleware d'authentification
  
    console.log('Fichier reçu :', req.file); // ✅ Vérifie si le fichier est bien reçu
    
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          phoneNumber,
          country,
          city,
          department,
          commune,
          photo: req.file ? req.file.filename : undefined, // ✅ Assurez-vous d'envoyer le nom du fichier
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          country: true,
          city: true,
          department: true,
          commune: true,
          photo: true,
          role: true,
        },
      });
  
      res.status(200).json({ 
        message: 'Profil mis à jour avec succès',
        user: updatedUser 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
    }
  };
  
  



// Fonction pour changer le mot de passe
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId; // Obtenu du middleware d'authentification

  try {
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier l'ancien mot de passe
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json({ message: 'Mot de passe changé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe', error: error.message });
  }
};

// Fonction pour supprimer un compte utilisateur
export const deleteUserAccount = async (req, res) => {
  const userId = req.user.userId; // Obtenu du middleware d'authentification

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ message: 'Compte utilisateur supprimé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la suppression du compte', error: error.message });
  }
};

// Fonction pour vérifier si un token est valide
export const verifyToken = async (req, res) => {
  try {
    // Le middleware d'authentification a déjà vérifié le token
    // Donc si nous arrivons ici, le token est valide
    
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({ 
      message: 'Token valide',
      user: user
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Token invalide', error: error.message });
  }
};

// Fonction pour obtenir tous les utilisateurs (admin uniquement)
export const getAllUsers = async (req, res) => {
  try {
    // Vérifier si l'utilisateur est un administrateur
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        country: true,
        city: true,
        department: true,
        commune: true,
        photo: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        // Ne pas inclure le mot de passe et les codes
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs', error: error.message });
  }
};

// Fonction pour mettre à jour le rôle d'un utilisateur (admin uniquement)
export const updateUserRole = async (req, res) => {
  const { userId, role } = req.body;

  try {
    // Vérifier si l'utilisateur est un administrateur
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier si le rôle est valide
    const validRoles = ['USER', 'ADMIN', 'PROVIDER', 'COMPANY'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    // Mettre à jour le rôle de l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    res.status(200).json({
      message: 'Rôle mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du rôle', error: error.message });
  }
};

// Fonction pour renvoyer un code de vérification
export const resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Si l'utilisateur est déjà vérifié
    if (user.isVerified) {
      return res.status(400).json({ 
        message: 'Cet utilisateur est déjà vérifié',
        isVerified: true
      });
    }

    // Générer un nouveau code de vérification
    const verificationCode = generateVerificationCode();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    // Mettre à jour l'utilisateur avec le nouveau code
    await prisma.user.update({
      where: { email },
      data: {
        verificationCode,
        tokenExpiry
      },
    });

    // Envoyer un email avec le nouveau code
    await sendVerificationEmail(email, verificationCode);

    res.status(200).json({ 
      message: 'Un nouveau code de vérification a été envoyé à votre adresse email',
      email: email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du code de vérification', error: error.message });
  }
};

// Fonction pour vérifier l'état de la vérification d'un utilisateur
export const checkVerificationStatus = async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({ 
      isVerified: user.isVerified,
      email: user.email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la vérification du statut', error: error.message });
  }
};

// Middleware d'authentification
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token d\'authentification requis' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide ou expiré' });
    }
    req.user = user;
    next();
  });
};

// Middleware pour vérifier le rôle d'administrateur
export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};

// Fonction pour déconnecter un utilisateur (côté serveur - principalement invalidation de jetons)
export const logoutUser = async (req, res) => {
  // Avec JWT, la déconnexion est principalement gérée côté client
  // Mais nous pouvons ajouter le jeton à une liste noire si nécessaire
  
  try {
    // Si vous implémentez une liste noire de jetons, ajoutez le code ici
    // Par exemple:
    // await prisma.blacklistedToken.create({
    //   data: {
    //     token: req.headers.authorization.split(' ')[1],
    //     expiresAt: new Date(req.user.exp * 1000), // exp est en secondes
    //   },
    // });

    res.status(200).json({ message: 'Déconnexion réussie' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la déconnexion', error: error.message });
  }
};
// authController.js - Adapté pour onboarding progressif avec votre structure

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../../services/emailService.js';
import jwt from 'jsonwebtoken';
import cloudinary from '../../utils/cloudinary.js';
import { authErrors, userErrors, serverErrors } from '../../utils/errorMessages.js';

const prisma = new PrismaClient();

// ===============================================
// 📊 FONCTIONS UTILITAIRES ONBOARDING
// ===============================================

const calculateProfileCompletion = (user) => {
  const fields = [
    'email', 'firstName', 'lastName', 'phoneNumber', 
    'country', 'city', 'photo'
  ];
  
  const completedFields = fields.filter(field => 
    user[field] && user[field].toString().trim() !== ''
  ).length;
  
  return Math.round((completedFields / fields.length) * 100);
};

const getNextOnboardingStep = (user) => {
  if (!user.firstName || !user.lastName) return 'personal_info';
  if (!user.phoneNumber) return 'contact_info';
  if (!user.country || !user.city) return 'address_info';
  if (!user.photo) return 'profile_photo';
  return 'completed';
};

const determineOnboardingStep = (user) => {
  if (!user.isVerified) return 'email_verification';
  if (!user.firstName || !user.lastName) return 'personal_info';
  if (!user.phoneNumber) return 'contact_info';
  if (!user.country || !user.city) return 'address_info';
  if (!user.photo) return 'profile_photo';
  return 'completed';
};

// Fonction pour générer un code de vérification
const generateVerificationCode = () => {
  return crypto.randomBytes(3).toString('hex'); // Code de 6 caractères
};

// ===============================================
// 🚀 INSCRIPTION ADAPTÉE (2 MODES)
// ===============================================

export const registerUser = async (req, res, next) => {
  const { 
    email, 
    password, 
    role,
    // Champs optionnels pour compatibilité avec votre frontend actuel
    firstName, 
    lastName, 
    phoneNumber, 
    country, 
    city, 
    department, 
    commune 
  } = req.body;
  
  let photoUrl = null;

  try {
    console.log('📧 Inscription pour:', email);
    console.log('📝 Champs reçus:', { 
      firstName, lastName, phoneNumber, country, city 
    });

    // 🔍 MODE 1: Si seulement email + password = INSCRIPTION SIMPLE
    const isSimpleRegistration = !firstName && !lastName && !phoneNumber;
    
    if (isSimpleRegistration) {
      console.log('🎯 Mode inscription simple (Jumia style)');
    } else {
      console.log('📋 Mode inscription complète (votre style actuel)');
    }

    // Vérifier si un fichier a été uploadé
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'profile_photos', 
          use_filename: true,
          unique_filename: true,
        });
        photoUrl = result.secure_url;
      } catch (cloudinaryError) {
        return next({
          name: 'CloudinaryError',
          message: authErrors.cloudinary.uploadFailed,
          details: cloudinaryError.message,
          status: 500
        });
      }
    }

    // Vérifier si l'email existe déjà
    const existingEmailUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingEmailUser) {
      if (existingEmailUser.isVerified) {
        return res.status(400).json({ 
          status: 'error',
          code: 'EMAIL_EXISTS',
          message: authErrors.registration.emailExists
        });
      } else {
        // Supprimer l'ancien utilisateur non vérifié
        await prisma.user.delete({
          where: { id: existingEmailUser.id }
        });
      }
    }

    // Vérifier le téléphone seulement s'il est fourni
    if (phoneNumber) {
      const existingPhoneUser = await prisma.user.findUnique({
        where: { phoneNumber }
      });
      
      if (existingPhoneUser) {
        if (existingPhoneUser.isVerified) {
          return res.status(400).json({ 
            status: 'error',
            code: 'PHONE_EXISTS',
            message: authErrors.registration.phoneExists
          });
        } else {
          // Supprimer l'ancien utilisateur non vérifié
          await prisma.user.delete({
            where: { id: existingPhoneUser.id }
          });
        }
      }
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Générer un code de vérification
    const verificationCode = generateVerificationCode();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Convertir le rôle
    let userRole = 'CLIENT'; // Défaut
    if (role === 'CLIENT' || role === 'MERCHANT' || role === 'SUPPLIER') {
      userRole = role;
    }

    // 🎯 CALCUL AUTOMATIQUE DU STEP ET COMPLETION
    const baseCompletion = 20; // Email + password
    let profileCompletion = baseCompletion;
    let onboardingStep = 'email_verification';

    // Ajouter à la completion selon les champs fournis
    if (firstName && lastName) profileCompletion += 20;
    if (phoneNumber) profileCompletion += 20;
    if (country && city) profileCompletion += 20;
    if (photoUrl) profileCompletion += 20;

    // Déterminer l'étape après vérification email
    let nextStepAfterVerification = 'personal_info';
    if (firstName && lastName && phoneNumber && country && city) {
      nextStepAfterVerification = photoUrl ? 'completed' : 'profile_photo';
    } else if (firstName && lastName && phoneNumber) {
      nextStepAfterVerification = 'address_info';
    } else if (firstName && lastName) {
      nextStepAfterVerification = 'contact_info';
    }

    // 🏗️ CRÉATION UTILISATEUR FLEXIBLE
    const userData = {
      email,
      password: hashedPassword,
      role: userRole,
      verificationCode,
      tokenExpiry,
      isVerified: false,
      onboardingStep,
      profileCompletion,
      isProfileCompleted: profileCompletion >= 100
    };

    // Ajouter les champs optionnels s'ils sont fournis
    if (firstName) userData.firstName = firstName;
    if (lastName) userData.lastName = lastName;
    if (phoneNumber) userData.phoneNumber = phoneNumber;
    if (country) userData.country = country;
    if (city) userData.city = city;
    if (department) userData.department = department;
    if (commune) userData.commune = commune;
    if (photoUrl) userData.photo = photoUrl;

    const newUser = await prisma.user.create({
      data: userData
    });

    // Envoyer l'email de vérification
    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (emailError) {
      console.error('Erreur d\'envoi d\'email:', emailError);
      
      if (process.env.NODE_ENV !== 'production') {
        return res.status(201).json({
          status: 'success',
          message: "Inscription réussie mais erreur d'envoi d'email",
          email: email,
          testVerificationCode: verificationCode,
          registrationType: isSimpleRegistration ? 'simple' : 'complete',
          onboarding: {
            step: 'email_verification',
            nextStepAfterVerification,
            progress: profileCompletion
          }
        });
      }
      
      return res.status(201).json({
        status: 'partial_success',
        code: 'EMAIL_FAILED',
        message: "Inscription réussie mais erreur lors de l'envoi de l'email de vérification",
        email: email,
        onboarding: {
          step: 'email_verification',
          progress: profileCompletion
        }
      });
    }

    // 🎯 RÉPONSE ADAPTÉE AU TYPE D'INSCRIPTION
    const response = {
      status: 'success',
      message: "Un code de vérification a été envoyé à votre email",
      email: email,
      registrationType: isSimpleRegistration ? 'simple' : 'complete',
      onboarding: {
        step: 'email_verification',
        nextStepAfterVerification,
        progress: profileCompletion,
        isSimple: isSimpleRegistration
      }
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    next(error);
  }
};

// ===============================================
// ✅ VÉRIFICATION EMAIL AVEC AUTO-LOGIN
// ===============================================

export const verifyCodeAndCompleteRegistration = async (req, res, next) => {
  const { email, verificationCode } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ 
        status: 'error',
        code: 'EMAIL_REQUIRED',
        message: authErrors.verification.emailRequired
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: authErrors.verification.userNotFound
      });
    }

    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return res.status(400).json({ 
        status: 'error',
        code: 'CODE_EXPIRED',
        message: authErrors.verification.codeExpired
      });
    }

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INCORRECT_CODE',
        message: authErrors.verification.incorrectCode
      });
    }

    // 🔄 CALCUL DU PROCHAIN STEP APRÈS VÉRIFICATION
    const nextStep = getNextOnboardingStep(user);
    const profileCompletion = calculateProfileCompletion(user);
    const isProfileComplete = nextStep === 'completed';

    // ✅ MISE À JOUR UTILISATEUR
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        verificationCode: null,
        tokenExpiry: null,
        onboardingStep: isProfileComplete ? 'completed' : nextStep,
        profileCompletion,
        isProfileCompleted: isProfileComplete
      },
    });

    // 🎯 GÉNÉRATION TOKEN POUR AUTO-LOGIN
    const token = jwt.sign(
      { 
        userId: updatedUser.id, 
        email: updatedUser.email, 
        role: updatedUser.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Email de bienvenue
    try {
      await sendWelcomeEmail(updatedUser.email, updatedUser.firstName || 'Nouvel utilisateur');
    } catch (emailError) {
      console.error('Erreur email bienvenue:', emailError);
    }

    // 🎉 RÉPONSE AVEC TOKEN ET INFOS ONBOARDING
    res.status(200).json({ 
      status: 'success',
      message: 'Email vérifié avec succès !',
      token, // 🔑 TOKEN POUR CONNEXION AUTOMATIQUE
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        photo: updatedUser.photo,
        isVerified: true
      },
      onboarding: {
        isRequired: !isProfileComplete,
        nextStep: nextStep,
        progress: profileCompletion,
        completed: isProfileComplete,
        message: isProfileComplete 
          ? 'Profil complètement configuré !' 
          : 'Complétez votre profil pour une meilleure expérience'
      }
    });

  } catch (error) {
    next(error);
  }
};

// ===============================================
// 🔐 LOGIN AVEC INFOS ONBOARDING
// ===============================================

export const loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ 
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: authErrors.login.invalidCredentials
      });
    }

    // 🔍 VÉRIFICATION EMAIL
    if (!user.isVerified) {
      const verificationCode = generateVerificationCode();
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { email },
        data: { 
          verificationCode,
          tokenExpiry
        },
      });

      try {
        await sendVerificationEmail(email, verificationCode);
      } catch (emailError) {
        console.error('Erreur email:', emailError);
        
        if (process.env.NODE_ENV !== 'production') {
          return res.status(403).json({ 
            status: 'error',
            code: 'NOT_VERIFIED',
            message: authErrors.login.notVerified,
            needsVerification: true,
            email: email,
            testVerificationCode: verificationCode
          });
        }
      }

      return res.status(403).json({ 
        status: 'error',
        code: 'NOT_VERIFIED',
        message: authErrors.login.notVerified,
        needsVerification: true,
        email: email
      });
    }

    // 🔒 VÉRIFICATION MOT DE PASSE
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: authErrors.login.invalidCredentials
      });
    }

    // 🎯 MISE À JOUR LAST LOGIN
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        lastLogin: new Date(),
        lastActive: new Date(),
        isOnline: true
      }
    });

    // 🔑 GÉNÉRATION TOKEN
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 📊 CALCUL INFOS ONBOARDING
    const profileCompletion = calculateProfileCompletion(user);
    const nextStep = getNextOnboardingStep(user);
    const currentStep = determineOnboardingStep(user);
    const isOnboardingRequired = nextStep !== 'completed';

    // 🎉 RÉPONSE AVEC INFOS ONBOARDING
    res.status(200).json({
      status: 'success',
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        photo: user.photo,
        role: user.role,
        country: user.country,
        city: user.city,
        profileCompletion
      },
      onboarding: {
        isRequired: isOnboardingRequired,
        currentStep,
        nextStep,
        progress: profileCompletion,
        completed: !isOnboardingRequired,
        steps: {
          email_verification: user.isVerified,
          personal_info: !!(user.firstName && user.lastName),
          contact_info: !!user.phoneNumber,
          address_info: !!(user.country && user.city),
          profile_photo: !!user.photo
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

// ===============================================
// 👤 FONCTIONS ONBOARDING PROGRESSIF
// ===============================================

export const completePersonalInfo = async (req, res, next) => {
  const { firstName, lastName, gender, dateOfBirth } = req.body;
  const userId = req.user.userId;

  try {
    if (!firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'Le prénom et nom sont requis'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        onboardingStep: 'contact_info',
        profileCompletion: 50
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        onboardingStep: true,
        profileCompletion: true
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Informations personnelles enregistrées',
      user: updatedUser,
      onboarding: {
        isRequired: true,
        nextStep: 'contact_info',
        progress: 50
      }
    });

  } catch (error) {
    next(error);
  }
};

export const completeContactInfo = async (req, res, next) => {
  const { phoneNumber, whatsappNumber } = req.body;
  const userId = req.user.userId;

  try {
    if (!phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Le numéro de téléphone est requis'
      });
    }

    // Vérifier unicité du téléphone
    const existingPhone = await prisma.user.findFirst({
      where: { 
        phoneNumber,
        id: { not: userId }
      }
    });

    if (existingPhone) {
      return res.status(400).json({
        status: 'error',
        code: 'PHONE_EXISTS',
        message: 'Ce numéro de téléphone est déjà utilisé'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber,
        whatsappNumber,
        onboardingStep: 'address_info',
        profileCompletion: 70
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Informations de contact enregistrées',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber
      },
      onboarding: {
        isRequired: true,
        nextStep: 'address_info',
        progress: 70
      }
    });

  } catch (error) {
    next(error);
  }
};

export const completeAddressInfo = async (req, res, next) => {
  const { country, city, department, commune, address } = req.body;
  const userId = req.user.userId;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        country,
        city,
        department,
        commune,
        address,
        onboardingStep: 'profile_photo',
        profileCompletion: 85
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Adresse enregistrée',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        city: updatedUser.city,
        country: updatedUser.country
      },
      onboarding: {
        isRequired: true,
        nextStep: 'profile_photo',
        progress: 85,
        canSkip: true
      }
    });

  } catch (error) {
    next(error);
  }
};

export const completeProfilePhoto = async (req, res, next) => {
  const userId = req.user.userId;
  let photoUrl = null;

  try {
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'profile_photos',
          public_id: `user_${userId}_${Date.now()}`,
          transformation: [
            { width: 400, height: 400, crop: 'fill', quality: 'auto' }
          ]
        });
        photoUrl = result.secure_url;
      } catch (cloudinaryError) {
        return next({
          name: 'CloudinaryError',
          message: 'Erreur lors de l\'upload de l\'image',
          details: cloudinaryError.message,
          status: 500
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        photo: photoUrl,
        onboardingStep: 'completed',
        profileCompletion: 100,
        isProfileCompleted: true
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Profil complété avec succès !',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        photo: updatedUser.photo
      },
      onboarding: {
        isRequired: false,
        completed: true,
        progress: 100
      }
    });

  } catch (error) {
    next(error);
  }
};

export const skipOnboardingStep = async (req, res, next) => {
  const { step } = req.body;
  const userId = req.user.userId;

  try {
    const stepMapping = {
      'profile_photo': { next: 'completed', completion: 90, profileCompleted: true },
      'address_info': { next: 'profile_photo', completion: 70, profileCompleted: false }
    };

    const stepInfo = stepMapping[step];
    if (!stepInfo) {
      return res.status(400).json({
        status: 'error',
        message: 'Étape non trouvée ou non ignorable'
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStep: stepInfo.next,
        profileCompletion: stepInfo.completion,
        isProfileCompleted: stepInfo.profileCompleted
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Étape ignorée',
      onboarding: {
        nextStep: stepInfo.next,
        progress: stepInfo.completion,
        completed: stepInfo.next === 'completed'
      }
    });

  } catch (error) {
    next(error);
  }
};

export const getOnboardingStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
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
        photo: true,
        onboardingStep: true,
        profileCompletion: true,
        isProfileCompleted: true
      }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Utilisateur non trouvé'
      });
    }

    const nextStep = getNextOnboardingStep(user);
    const completion = calculateProfileCompletion(user);

    res.status(200).json({
      status: 'success',
      user,
      onboarding: {
        isRequired: nextStep !== 'completed',
        currentStep: user.onboardingStep,
        nextStep,
        progress: completion,
        steps: {
          email_verification: true,
          personal_info: !!(user.firstName && user.lastName),
          contact_info: !!user.phoneNumber,
          address_info: !!(user.country && user.city),
          profile_photo: !!user.photo
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

// Fonction pour mot de passe oublié - envoi de code
export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: authErrors.verification.userNotFound
      });
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
    try {
      await sendPasswordResetEmail(email, resetCode);
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de réinitialisation:', emailError);
      
      // En mode développement, renvoyer le code de réinitialisation
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({
          status: 'partial_success',
          message: "Un code de réinitialisation a été généré mais l'email n'a pas pu être envoyé. Code de test:",
          email: email,
          testResetCode: resetCode // Uniquement pour les tests
        });
      }
      
      return res.status(500).json({
        status: 'error',
        code: 'EMAIL_FAILED',
        message: authErrors.email.sendFailed
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Un code de réinitialisation a été envoyé à votre adresse email.',
      email: email
    });
  } catch (error) {
    next(error);
  }
};

// Fonction pour réinitialiser le mot de passe avec le code
export const resetPassword = async (req, res, next) => {
  const { email, resetCode, newPassword } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: userErrors.notFound
      });
    }

    // Vérifier si le code a expiré
    if (!user.tokenExpiry || new Date() > user.tokenExpiry) {
      return res.status(400).json({ 
        status: 'error',
        code: 'RESET_CODE_EXPIRED',
        message: authErrors.password.resetCodeExpired
      });
    }

    // Vérifier si le code de réinitialisation est correct
    if (user.resetCode !== resetCode) {
      return res.status(400).json({ 
        status: 'error',
        code: 'RESET_CODE_INCORRECT',
        message: authErrors.password.resetCodeIncorrect
      });
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

    res.status(200).json({ 
      status: 'success',
      message: 'Mot de passe réinitialisé avec succès' 
    });
  } catch (error) {
    next(error);
  }
};

// Remplacez votre méthode getUserProfile par celle-ci:

export const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId; // Obtenu du middleware d'authentification
    console.log('📖 Récupération profil pour user:', userId);

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
        photo: true, // 🔥 AJOUT DU CHAMP PHOTO MANQUANT
        role: true,
        createdAt: true,
        updatedAt: true,
        // Ne pas inclure le mot de passe et les codes
      },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: userErrors.notFound
      });
    }

    console.log('✅ Profil trouvé avec photo:', user.photo); // 🔥 DEBUG

    res.status(200).json({ 
      status: 'success',
      user 
    });
  } catch (error) {
    console.error('❌ Erreur getUserProfile:', error);
    next(error);
  }
};

// Fonction pour mettre à jour le profil utilisateur - VERSION MODIFIÉE
// Fonction pour mettre à jour le profil utilisateur - VERSION DEBUG
export const updateUserProfile = async (req, res, next) => {
  console.log('🔄 === DÉBUT UPDATE PROFILE ===');
  console.log('📝 Body reçu:', req.body);
  console.log('👤 User dans token:', req.user);
  console.log('📁 Fichier reçu:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'Aucun fichier');
  
  const { firstName, lastName, phoneNumber, country, city, department, commune } = req.body;
  const userId = req.user.userId;
  
  try {
    console.log('👤 ID Utilisateur:', userId);
    
    let photoUrl;
    
    // 🔍 ÉTAPE 1: Vérifier si l'utilisateur existe
    console.log('🔍 Vérification utilisateur...');
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { photo: true, firstName: true, lastName: true }
    });
    
    console.log('👤 Utilisateur trouvé:', currentUser);
    
    if (!currentUser) {
      console.log('❌ Utilisateur non trouvé');
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé'
      });
    }
    
    // 🔍 ÉTAPE 2: Gestion du fichier image
    if (req.file) {
      console.log('📸 === TRAITEMENT IMAGE ===');
      console.log('📁 Détails fichier:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
        path: req.file.path
      });
      
      try {
        // Suppression ancienne photo
        if (currentUser.photo && currentUser.photo.includes('cloudinary.com')) {
          console.log('🗑️ Suppression ancienne photo:', currentUser.photo);
          try {
            const urlParts = currentUser.photo.split('/');
            const publicIdWithExtension = urlParts[urlParts.length - 1];
            const publicId = `profile_photos/${publicIdWithExtension.split('.')[0]}`;
            
            console.log('🗑️ Public ID à supprimer:', publicId);
            const deleteResult = await cloudinary.uploader.destroy(publicId);
            console.log('✅ Résultat suppression:', deleteResult);
          } catch (deleteError) {
            console.error('⚠️ Erreur suppression (continuons):', deleteError.message);
          }
        } else {
          console.log('ℹ️ Pas d\'ancienne photo à supprimer');
        }
        
        // Upload nouvelle photo
        console.log('📤 Upload vers Cloudinary...');
        
        const uploadOptions = {
          folder: 'profile_photos',
          public_id: `user_${userId}_${Date.now()}`,
          transformation: [
            {
              width: 800,
              height: 800,
              crop: 'limit',
              quality: 'auto:good',
              format: 'auto'
            }
          ],
          resource_type: 'image'
        };
        
        console.log('📤 Options upload:', uploadOptions);
        
        const result = await cloudinary.uploader.upload(req.file.path, uploadOptions);
        
        photoUrl = result.secure_url;
        
        console.log('✅ Upload réussi:', {
          url: photoUrl,
          publicId: result.public_id,
          format: result.format,
          dimensions: `${result.width}x${result.height}`,
          size: `${(result.bytes / 1024 / 1024).toFixed(2)}MB`
        });
        
      } catch (cloudinaryError) {
        console.error('❌ ERREUR CLOUDINARY:', {
          message: cloudinaryError.message,
          stack: cloudinaryError.stack,
          name: cloudinaryError.name
        });
        
        return res.status(500).json({
          status: 'error',
          code: 'CLOUDINARY_ERROR',
          message: 'Erreur lors de l\'upload de l\'image',
          details: cloudinaryError.message
        });
      }
    } else {
      console.log('ℹ️ Pas de nouveau fichier image');
    }
    
    // 🔍 ÉTAPE 3: Préparation des données
    console.log('💾 === MISE À JOUR BASE DE DONNÉES ===');
    
    const dataToUpdate = {};
    
    // Ajouter seulement les champs non vides
    if (firstName !== undefined && firstName !== '') dataToUpdate.firstName = firstName;
    if (lastName !== undefined && lastName !== '') dataToUpdate.lastName = lastName;
    if (phoneNumber !== undefined && phoneNumber !== '') dataToUpdate.phoneNumber = phoneNumber;
    if (country !== undefined && country !== '') dataToUpdate.country = country;
    if (city !== undefined && city !== '') dataToUpdate.city = city;
    if (department !== undefined && department !== '') dataToUpdate.department = department;
    if (commune !== undefined && commune !== '') dataToUpdate.commune = commune;
    
    // Ajouter la photo seulement si elle a été mise à jour
    if (photoUrl) {
      dataToUpdate.photo = photoUrl;
    }
    
    console.log('📝 Données à mettre à jour:', dataToUpdate);
    
    // 🔍 ÉTAPE 4: Mise à jour en base
    console.log('💾 Exécution update Prisma...');
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
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
    
    console.log('✅ Utilisateur mis à jour:', updatedUser);
    console.log('🎉 === FIN UPDATE PROFILE - SUCCÈS ===');
    
    res.status(200).json({ 
      status: 'success',
      message: 'Profil mis à jour avec succès',
      user: updatedUser 
    });
    
  } catch (error) {
    console.error('❌ === ERREUR UPDATE PROFILE ===');
    console.error('Type d\'erreur:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.code) {
      console.error('Code erreur:', error.code);
    }
    
    // Erreurs Prisma spécifiques
    if (error.name === 'PrismaClientKnownRequestError') {
      console.error('Erreur Prisma connue:', error.code);
      if (error.code === 'P2025') {
        return res.status(404).json({
          status: 'error',
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur non trouvé'
        });
      }
    }
    
    // Erreurs de validation Prisma
    if (error.name === 'PrismaClientValidationError') {
      console.error('Erreur validation Prisma:', error.message);
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.message
      });
    }
    
    // Erreur générique
    console.error('Erreur non gérée:', error);
    
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Fonction pour changer le mot de passe
export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId; // Obtenu du middleware d'authentification

  try {
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: userErrors.notFound
      });
    }

    // Vérifier l'ancien mot de passe
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        status: 'error',
        code: 'INCORRECT_PASSWORD',
        message: authErrors.password.incorrectCurrent
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json({ 
      status: 'success',
      message: 'Mot de passe changé avec succès' 
    });
  } catch (error) {
    next(error);
  }
};

// Fonction pour supprimer un compte utilisateur
export const deleteUserAccount = async (req, res, next) => {
  const userId = req.user.userId; // Obtenu du middleware d'authentification

  try {
    // Récupérer l'utilisateur pour voir s'il a une photo
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { photo: true }
    });
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: userErrors.notFound
      });
    }
    
    // Si l'utilisateur a une photo sur Cloudinary, la supprimer
    if (user.photo && user.photo.includes('cloudinary.com')) {
      try {
        // Extraire l'ID public de l'URL Cloudinary
        const publicId = user.photo.split('/').pop().split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`profile_photos/${publicId}`);
        }
      } catch (cloudinaryError) {
        console.error('Erreur lors de la suppression de l\'image:', cloudinaryError);
        // Continuer malgré l'erreur
      }
    }
    
    // Supprimer l'utilisateur
    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ 
      status: 'success',
      message: 'Compte utilisateur supprimé avec succès' 
    });
  } catch (error) {
    next(error);
  }
};

// Fonction pour vérifier si un token est valide
export const verifyToken = async (req, res, next) => {
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
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: userErrors.notFound
      });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'Token valide',
      user: user
    });
  } catch (error) {
    next(error);
  }
};

// Fonction pour obtenir tous les utilisateurs (admin uniquement)
export const getAllUsers = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est un administrateur
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        status: 'error',
        code: 'UNAUTHORIZED',
        message: authErrors.auth.adminOnly
      });
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

    res.status(200).json({ 
      status: 'success',
      users 
    });
  } catch (error) {
    next(error);
  }
};

// Fonction pour mettre à jour le rôle d'un utilisateur (admin uniquement)
export const updateUserRole = async (req, res, next) => {
  const { userId, role } = req.body;

  try {
    // Vérifier si l'utilisateur est un administrateur
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        status: 'error',
        code: 'UNAUTHORIZED',
        message: authErrors.auth.adminOnly
      });
    }

    // Vérifier si le rôle est valide
    const validRoles = ['USER', 'ADMIN', 'PROVIDER', 'COMPANY'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ROLE',
        message: authErrors.registration.invalidRole
      });
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
      status: 'success',
      message: 'Rôle mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    if (error.name === 'PrismaClientKnownRequestError' && error.code === 'P2025') {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: userErrors.notFound
      });
    }
    next(error);
  }
};

// Fonction pour renvoyer un code de vérification
export const resendVerificationCode = async (req, res, next) => {
  const { email } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: authErrors.verification.userNotFound
      });
    }

    // Si l'utilisateur est déjà vérifié
    if (user.isVerified) {
      return res.status(400).json({ 
        status: 'error',
        code: 'ALREADY_VERIFIED',
        message: authErrors.verification.alreadyVerified,
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
    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de vérification:', emailError);
      
      // En mode développement, renvoyer le code de vérification
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({
          status: 'partial_success',
          message: "Un nouveau code de vérification a été généré mais l'email n'a pas pu être envoyé. Code de test:",
          email: email,
          testVerificationCode: verificationCode // Uniquement pour les tests
        });
      }
      
      return res.status(500).json({
        status: 'error',
        code: 'EMAIL_FAILED',
        message: authErrors.email.sendFailed
      });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'Un nouveau code de vérification a été envoyé à votre adresse email',
      email: email
    });
  } catch (error) {
    next(error);
  }
};

// Fonction pour vérifier l'état de la vérification d'un utilisateur
export const checkVerificationStatus = async (req, res, next) => {
  const { email } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: authErrors.verification.userNotFound
      });
    }

    res.status(200).json({ 
      status: 'success',
      isVerified: user.isVerified,
      email: user.email
    });
  } catch (error) {
    next(error);
  }
};

// Middleware d'authentification
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      status: 'error',
      code: 'TOKEN_REQUIRED',
      message: authErrors.auth.tokenRequired
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        status: 'error',
        code: 'INVALID_TOKEN',
        message: authErrors.auth.invalidToken
      });
    }
    req.user = user;
    next();
  });
};

// Middleware pour vérifier le rôle d'administrateur
export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      status: 'error',
      code: 'UNAUTHORIZED',
      message: authErrors.auth.adminOnly
    });
  }
  next();
};

// Fonction pour déconnecter un utilisateur (côté serveur - principalement invalidation de jetons)
export const logoutUser = async (req, res, next) => {
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

    res.status(200).json({ 
      status: 'success',
      message: 'Déconnexion réussie' 
    });
  } catch (error) {
    next(error);
  }
};
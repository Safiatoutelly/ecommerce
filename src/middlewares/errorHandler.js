// errorHandler.js - Middleware pour gérer toutes les erreurs de l'application

import { serverErrors } from '../utils/errorMessages.js';

// Middleware pour gérer les erreurs de validation Joi/Express-Validator
const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError' || err.name === 'Error' && err.joi) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: err.details ? err.details[0].message : err.message,
      errors: err.details || [err]
    });
  }
  next(err);
};

// Middleware pour gérer les erreurs de Multer (upload de fichiers)
const multerErrorHandler = (err, req, res, next) => {
  if (err.name === 'MulterError') {
    let message = serverErrors.validation;
    let code = 'FILE_UPLOAD_ERROR';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'La taille du fichier dépasse la limite autorisée (2 Mo)';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Type de fichier non attendu';
        code = 'INVALID_FILE_TYPE';
        break;
      default:
        message = err.message;
    }
    
    return res.status(400).json({
      status: 'error',
      code,
      message
    });
  }
  next(err);
};

// Middleware pour gérer les erreurs de Cloudinary
const cloudinaryErrorHandler = (err, req, res, next) => {
  if (err.name === 'CloudinaryError' || (err.message && err.message.includes('Cloudinary'))) {
    return res.status(500).json({
      status: 'error',
      code: 'CLOUDINARY_ERROR',
      message: 'Erreur lors du traitement de l\'image',
      details: err.message
    });
  }
  next(err);
};

// Middleware pour gérer les erreurs de JWT
const jwtErrorHandler = (err, req, res, next) => {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Token invalide'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      code: 'TOKEN_EXPIRED',
      message: 'Token expiré'
    });
  }
  
  next(err);
};

// Middleware pour gérer les erreurs de Prisma
const prismaErrorHandler = (err, req, res, next) => {
  if (err.name === 'PrismaClientKnownRequestError' || err.name === 'PrismaClientValidationError') {
    // Erreurs communes de Prisma et messages personnalisés
    let message = 'Erreur de base de données';
    let code = 'DATABASE_ERROR';
    
    // P2002 est le code pour les erreurs d'unicité
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'champ';
      message = `Un enregistrement avec ce ${field} existe déjà`;
      code = 'DUPLICATE_ENTRY';
    }
    
    // P2025 est le code pour les enregistrements non trouvés
    if (err.code === 'P2025') {
      message = 'Enregistrement non trouvé';
      code = 'RECORD_NOT_FOUND';
    }
    
    return res.status(400).json({
      status: 'error',
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  next(err);
};

// Middleware pour gérer les erreurs d'email
const emailErrorHandler = (err, req, res, next) => {
  if (err.name === 'Error' && (err.code === 'EENVELOPE' || err.code === 'EAUTH' || err.message.includes('email'))) {
    return res.status(500).json({
      status: 'error',
      code: 'EMAIL_ERROR',
      message: 'Erreur lors de l\'envoi de l\'email',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  next(err);
};

// Middleware pour gérer toutes les autres erreurs
const globalErrorHandler = (err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  
  // Déterminer le statut HTTP approprié
  const statusCode = err.statusCode || err.status || 500;
  
  // Par défaut, masquer les détails techniques en production
  const response = {
    status: 'error',
    code: err.code || 'SERVER_ERROR',
    message: statusCode === 500 ? serverErrors.internal : err.message || 'Une erreur est survenue'
  };
  
  // En développement, inclure plus de détails
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.details || err.message;
  }
  
  res.status(statusCode).json(response);
};

// Exporter une fonction qui enregistre tous les middleware de gestion d'erreurs
const setupErrorHandlers = (app) => {
  app.use(validationErrorHandler);
  app.use(multerErrorHandler);
  app.use(cloudinaryErrorHandler);
  app.use(jwtErrorHandler);
  app.use(prismaErrorHandler);
  app.use(emailErrorHandler);
  app.use(globalErrorHandler);
};

export default setupErrorHandlers;
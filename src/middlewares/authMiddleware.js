import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Middleware d'authentification
export const authenticate = async (req, res, next) => {
  try {
    // Récupérer le token depuis l'en-tête d'autorisation
    const authHeader = req.headers.authorization;
    
    console.log('Headers reçus:', req.headers);
    console.log('Authorization header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extrait:', token.substring(0, 15) + '...');

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé:", decoded);

    // Vérifier la structure du token et s'assurer que userId est présent
    if (!decoded.userId) {
      console.log("Token invalide: userId manquant");
      return res.status(401).json({ message: "Token invalide: format incorrect" });
    }
    
    // Trouver l'utilisateur avec l'ID du token
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) } // Conversion en nombre si nécessaire
    });

    console.log("Utilisateur trouvé:", user ? `ID: ${user.id}` : "Non trouvé");

    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé" });
    }

    // Ajouter l'utilisateur à l'objet request
    req.user = user;
    next();
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: "Votre session a expiré",
        error: "jwt expired"
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: "Token invalide",
        error: error.message
      });
    }
    
    return res.status(500).json({
      message: "Erreur lors de l'authentification",
      error: error.message
    });
  }
};


// Vérifier si l'utilisateur est un commerçant
export const isMerchant = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  
  if (req.user.role !== 'MERCHANT') {
    return res.status(403).json({ 
      message: "Accès refusé. Seuls les commerçants peuvent accéder à cette fonctionnalité" 
    });
  }
  
  next();
};

// Vérifier si l'utilisateur est un client
export const isClient = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  
  if (req.user.role !== 'CLIENT') {
    return res.status(403).json({ 
      message: "Accès refusé. Seuls les clients peuvent accéder à cette fonctionnalité" 
    });
  }
  
  next();
};

// Vérifier si l'utilisateur est un fournisseur
export const isSupplier = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  
  if (req.user.role !== 'SUPPLIER') {
    return res.status(403).json({ 
      message: "Accès refusé. Seuls les fournisseurs peuvent accéder à cette fonctionnalité" 
    });
  }
  
  next();
};
import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';
// En haut de votre fichier shopController.js
import { sendContactMerchantEmail, sendConfirmationToCustomer } from '../services/emailService.js';
const prisma = new PrismaClient();

export const createShop = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      phoneNumber, 
      address 
    } = req.body;
    
    const userId = req.user.id; 
    
    // Vérifier si l'utilisateur existe et est un commerçant
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    
    if (user.role !== 'MERCHANT') {
      return res.status(403).json({ 
        message: "Seuls les commerçants peuvent créer une boutique" 
      });
    }
    
    // Vérifier si l'utilisateur possède déjà une boutique
    const existingShop = await prisma.shop.findUnique({
      where: { userId: userId }
    });
    
    if (existingShop) {
      return res.status(400).json({ 
        message: "Vous possédez déjà une boutique" 
      });
    }
    
    // Récupérer le chemin du logo téléchargé (si présent)
    const logo = req.file ? req.file.path : null;
    
    // Créer la boutique
    const newShop = await prisma.shop.create({
      data: {
        name,
        description,
        phoneNumber,
        address,
        userId,
        logo
      }
    });
    
    // Créer une notification pour le commerçant
    await createNotification({
      userId,
      type: "SHOP",
      message: `Félicitations! Votre boutique "${name}" a été créée avec succès.`,
      resourceId: newShop.id,
      resourceType: "Shop",
      actionUrl: `/dashboard/shops/${newShop.id}`,
      priority: 1 
    });
    
    return res.status(201).json({
      message: "Boutique créée avec succès",
      shop: newShop
    });
  } catch (error) {
    console.error("Erreur lors de la création de la boutique:", error);
    
    if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
      return res.status(400).json({ 
        message: "Ce numéro de téléphone est déjà utilisé par une autre boutique" 
      });
    }
    
    return res.status(500).json({ 
      message: "Une erreur est survenue lors de la création de la boutique",
      error: error.message 
    });
  }
};
// Méthode pour récupérer la boutique de l'utilisateur connecté


// Méthode CORRIGÉE pour récupérer la boutique de l'utilisateur connecté
export const getMyShop = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupérer la boutique associée à l'utilisateur connecté
    const shop = await prisma.shop.findUnique({
      where: { userId: userId }
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Vous n'avez pas encore de boutique" });
    }
    
    // Récupérer les produits associés à la boutique
    const products = await prisma.product.findMany({
      where: { shopId: shop.id },
      include: {
        images: true // Inclure les images des produits
      }
    });
    
    return res.status(200).json({
      message: "Boutique récupérée avec succès",
      shop,
      products
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la boutique:", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération de votre boutique",
      error: error.message
    });
  }
};

// Méthode pour récupérer les produits d'une boutique spécifique
export const getShopProducts = async (req, res) => {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "ID de boutique invalide" });
    }
    
    // Vérifier si la boutique existe
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }
    
    // Récupérer les produits de cette boutique
    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: {
        images: true
      }
    });
    
    return res.status(200).json({
      message: "Produits récupérés avec succès",
      products
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des produits:", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération des produits de la boutique",
      error: error.message
    });
  }
};

// Autres fonctions pour la gestion des boutiques
export const getShopById = async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "ID de boutique invalide" });
    }
    
    // Vérifier si la boutique existe dans la base de données
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    // Récupérer les produits de cette boutique
    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: {
        images: true
      }
    });

    // Retourner la boutique trouvée avec ses produits
    return res.status(200).json({
      message: "Boutique récupérée avec succès",
      shop,
      products
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la boutique:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération de la boutique",
      error: error.message
    });
  }
};

export const updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "ID de boutique invalide" });
    }
    
    const { name, description, phoneNumber, address } = req.body;
    const userId = req.user.id;
    
    // Vérifier si la boutique existe et appartient à l'utilisateur
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }
    
    if (shop.userId !== userId) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier cette boutique" });
    }
    
    // Récupérer le chemin du logo téléchargé (si présent)
    const logo = req.file ? req.file.path : shop.logo;
    
    // Mettre à jour la boutique avec les nouvelles données
    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        name: name || shop.name,
        description: description || shop.description,
        phoneNumber: phoneNumber || shop.phoneNumber,
        address: address || shop.address,
        logo
      }
    });
  
    return res.status(200).json({
      message: "Boutique mise à jour avec succès",
      shop: updatedShop
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la boutique:", error);
    
    // Gérer l'erreur de numéro de téléphone en double
    if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
      return res.status(400).json({ 
        message: "Ce numéro de téléphone est déjà utilisé par une autre boutique" 
      });
    }
    
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour de la boutique",
      error: error.message
    });
  }
};

export const getAllShops = async (req, res) => {
  try {
    // Récupérer toutes les boutiques depuis la base de données
    const shops = await prisma.shop.findMany({
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            photo: true
          }
        }
      }
    });
    
    // Retourner les boutiques trouvées
    return res.status(200).json({
      message: shops.length > 0 ? "Liste des boutiques récupérée avec succès" : "Aucune boutique disponible",
      shops
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des boutiques:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des boutiques",
      error: error.message
    });
  }
};

export const deleteShop = async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "ID de boutique invalide" });
    }
    
    const userId = req.user.id;
    
    // Vérifier si la boutique existe et appartient à l'utilisateur
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }
    
    if (shop.userId !== userId) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer cette boutique" });
    }
    
    // Supprimer tous les produits liés à cette boutique
    await prisma.product.deleteMany({
      where: { shopId: shopId }
    });
    
    // Supprimer la boutique
    await prisma.shop.delete({
      where: { id: shopId }
    });
    
    return res.status(200).json({
      message: "Boutique et tous ses produits supprimés avec succès"
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de la boutique:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la suppression de la boutique",
      error: error.message
    });
  }
};
export const getShopWithMerchantDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "ID de boutique invalide" });
    }
    
    // Récupérer la boutique avec les infos détaillées du commerçant
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true, // ✅ Correction ici
            photo: true,
            createdAt: true,
          }
        }
      }
    });
    
    
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    // Récupérer les produits de cette boutique
    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: {
        images: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Limiter aux 10 produits les plus récents
    });

    // Compter le nombre total de produits
    const totalProducts = await prisma.product.count({
      where: { shopId: shopId }
    });

    // Calculer les statistiques du commerçant
    const merchantStats = {
      totalProducts,
      memberSince: shop.owner.createdAt,
      // Vous pouvez ajouter d'autres statistiques ici
    };

    // Retourner la boutique avec les infos du commerçant
    return res.status(200).json({
      message: "Informations de la boutique et du commerçant récupérées avec succès",
      shop,
      products,
      merchantStats
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des informations:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des informations",
      error: error.message
    });
  }
};
export const contactMerchant = async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({ 
        message: "Vous devez être connecté pour contacter un commerçant" 
      });
    }

    const { shopId } = req.params;
    const { subject, message } = req.body;
    
    // Récupérer les informations de l'utilisateur connecté
    const { id: userId, email, firstName, lastName } = req.user;

    // Validation des entrées
    if (!subject || !message) {
      return res.status(400).json({
        message: "Le sujet et le message sont obligatoires"
      });
    }

    // Conversion du shopId en nombre et vérification
    const shopIdInt = parseInt(shopId, 10);
    if (isNaN(shopIdInt)) {
      return res.status(400).json({ message: "ID de boutique invalide" });
    }

    // Récupérer la boutique avec les informations du propriétaire
    const shop = await prisma.shop.findUnique({
      where: { id: shopIdInt },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    // Vérifier que l'utilisateur ne contacte pas sa propre boutique
    if (shop.owner.id === userId) {
      return res.status(400).json({ 
        message: "Vous ne pouvez pas envoyer un message à votre propre boutique" 
      });
    }

    // Créer le message de contact dans la base de données
    const contactMessage = await prisma.merchantContact.create({
      data: {
        shopId: shopIdInt,
        merchantId: shop.owner.id,
        subject,
        senderEmail: email, // Email de l'utilisateur connecté
        message,
        status: 'UNREAD'
      }
    });

    // Envoyer l'email au commerçant
    await sendContactMerchantEmail(
      shop.owner.email,  // Email du commerçant (destinataire)
      subject,           // Sujet du message
      email,             // Email de l'utilisateur connecté
      message,           // Message
      shop.name          // Nom de la boutique
    );

    // Créer une notification pour le commerçant avec des informations personnelles
    await createNotification({
      userId: shop.owner.id,
      type: "MESSAGE",
      message: `Nouveau message de ${firstName} ${lastName} concernant votre boutique ${shop.name} : "${subject}"`,
      resourceId: contactMessage.id,
      resourceType: "MerchantContact",
      actionUrl: `/dashboard/messages/${contactMessage.id}`,
      priority: 2
    });

    // Envoyer un email de confirmation au client
    try {
      await sendConfirmationToCustomer(
        email,                // Email de l'utilisateur connecté
        subject,              // Sujet du message
        shop.name,            // Nom de la boutique
        shop.owner.firstName  // Prénom du commerçant
      );
    } catch (emailError) {
      console.error("Erreur email de confirmation :", emailError);
      // On continue même si l'email de confirmation échoue
    }

    return res.status(200).json({
      success: true,
      message: "Votre message a été envoyé avec succès au commerçant",
      contact: {
        id: contactMessage.id,
        createdAt: contactMessage.createdAt
      }
    });
  } catch (error) {
    console.error("Erreur:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'envoi du message",
      error: error.message
    });
  }
};
export const respondToContactMessage = async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté et est le propriétaire de la boutique
    if (!req.user) {
      return res.status(401).json({
        message: "Vous devez être connecté pour répondre à un message"
      });
    }

    const { contactId } = req.params;
    const { response } = req.body;

    // Validation des entrées
    if (!response) {
      return res.status(400).json({
        message: "La réponse est obligatoire"
      });
    }

    // Convertir contactId en nombre
    const contactIdInt = parseInt(contactId, 10);
    if (isNaN(contactIdInt)) {
      return res.status(400).json({ message: "ID de contact invalide" });
    }

    // Récupérer le message de contact original
    const originalContact = await prisma.merchantContact.findUnique({
      where: { id: contactIdInt },
      include: {
        shop: {
          include: {
            owner: true
          }
        }
      }
    });

    // Vérifier que le message existe
    if (!originalContact) {
      return res.status(404).json({ message: "Message de contact non trouvé" });
    }

    // Vérifier que l'utilisateur connecté est bien le propriétaire de la boutique
    if (originalContact.shop.owner.id !== req.user.id) {
      return res.status(403).json({ 
        message: "Vous n'êtes pas autorisé à répondre à ce message" 
      });
    }

    // Créer la réponse dans la base de données
    const contactResponse = await prisma.merchantContactResponse.create({
      data: {
        merchantContactId: contactIdInt,
        merchantId: req.user.id,
        response
      }
    });

    // Mettre à jour le statut du message original
    await prisma.merchantContact.update({
      where: { id: contactIdInt },
      data: { status: 'RESPONDED' }
    });

    // Envoyer un email à l'utilisateur qui a envoyé le message original
    await sendResponseEmail(
      originalContact.senderEmail, // Email de l'expéditeur original
      originalContact.subject,     // Sujet du message original
      response,                    // Réponse du commerçant
      originalContact.shop.name    // Nom de la boutique
    );

    // Créer une notification pour l'utilisateur
    await createNotification({
      userId: originalContact.merchantContact.userId, // ID de l'utilisateur qui a envoyé le message
      type: "MESSAGE_RESPONSE",
      message: `Le commerçant a répondu à votre message concernant la boutique ${originalContact.shop.name}`,
      resourceId: contactResponse.id,
      resourceType: "MerchantContactResponse",
       redirectUrl: `/dashboard/messages/${contactResponse.id}`,
      priority: 1
    });

    return res.status(200).json({
      success: true,
      message: "Votre réponse a été envoyée avec succès",
      response: {
        id: contactResponse.id,
        createdAt: contactResponse.createdAt
      }
    });

  } catch (error) {
    console.error("Erreur lors de la réponse au message:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'envoi de la réponse",
      error: error.message
    });
  }
};
export const getAllUserMessages = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({ message: "Non autorisé" });
    }

    // Récupérer les messages en fonction du rôle de l'utilisateur
    const messages = await prisma.merchantContact.findMany({
      where: {
        OR: [
          { senderId: req.user.id }, // Messages envoyés par l'utilisateur
          { shop: { ownerId: req.user.id } } // Messages reçus par la boutique de l'utilisateur
        ]
      },
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        shop: {
          select: {
            name: true
          }
        },
        responses: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      messages,
      totalCount: messages.length
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des messages:", error);
    return res.status(500).json({ 
      message: "Erreur lors de la récupération des messages" 
    });
  }
};

// Fonction pour notifier un commerçant qu'un client lui a laissé un message

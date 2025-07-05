import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';
// En haut de votre fichier shopController.js
import { sendContactMerchantEmail, sendConfirmationToCustomer } from '../services/emailService.js';
import cloudinary from '../utils/cloudinary.js';
import { shopErrors } from '../utils/errorMessages.js';
import fs from 'fs';

const prisma = new PrismaClient();

export const createShop = async (req, res, next) => {
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
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: "Utilisateur non trouvé" 
      });
    }
    
    if (user.role !== 'MERCHANT') {
      return res.status(403).json({ 
        status: 'error',
        code: 'NOT_MERCHANT',
        message: shopErrors.creation.notMerchant
      });
    }
    
    // Vérifier si l'utilisateur possède déjà une boutique
    const existingShop = await prisma.shop.findUnique({
      where: { userId: userId }
    });
    
    if (existingShop) {
      return res.status(400).json({ 
        status: 'error',
        code: 'SHOP_EXISTS',
        message: shopErrors.creation.alreadyHasShop
      });
    }
    
    // Traitement du logo avec Cloudinary
    let logoUrl = null;
    
    if (req.file) {
      try {
        // Upload de l'image vers Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'shop_logos',
          use_filename: true,
          unique_filename: true,
        });
        
        logoUrl = result.secure_url;
        
        // Supprimer le fichier temporaire
        fs.unlinkSync(req.file.path);
      } catch (cloudinaryError) {
        console.error('Erreur lors de l\'upload du logo vers Cloudinary:', cloudinaryError);
        return next({
          name: 'CloudinaryError',
          message: shopErrors.creation.uploadFailed,
          details: cloudinaryError.message,
          status: 500
        });
      }
    }
    
    // Créer la boutique
    const newShop = await prisma.shop.create({
      data: {
        name,
        description,
        phoneNumber,
        address,
        userId,
        logo: logoUrl
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
      status: 'success',
      message: "Boutique créée avec succès",
      shop: newShop
    });
  } catch (error) {
    // Gestion spécifique de l'erreur de numéro de téléphone en double
    if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
      return res.status(400).json({ 
        status: 'error',
        code: 'PHONE_EXISTS',
        message: shopErrors.creation.phoneNumberExists
      });
    }
    
    return next(error);
  }
};

export const getMyShop = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Récupérer la boutique associée à l'utilisateur connecté
    const shop = await prisma.shop.findUnique({
      where: { userId: userId }
    });
    
    if (!shop) {
      return res.status(404).json({ 
        status: 'error',
        code: 'NO_SHOP_OWNED',
        message: shopErrors.retrieval.noShopOwned
      });
    }
    
    // Récupérer les produits associés à la boutique
    const products = await prisma.product.findMany({
      where: { shopId: shop.id },
      include: {
        images: true
      }
    });
    
    return res.status(200).json({
      status: 'success',
      message: "Boutique récupérée avec succès",
      shop,
      products
    });
  } catch (error) {
    next(error);
  }
};

export const getShopProducts = async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ID',
        message: shopErrors.retrieval.invalidId
      });
    }
    
    // Vérifier si la boutique existe
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ 
        status: 'error',
        code: 'SHOP_NOT_FOUND',
        message: shopErrors.retrieval.notFound
      });
    }
    
    // Récupérer les produits de cette boutique
    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: {
        images: true
      }
    });
    
    return res.status(200).json({
      status: 'success',
      message: products.length > 0 ? "Produits récupérés avec succès" : shopErrors.retrieval.noProductsFound,
      products
    });
  } catch (error) {
    next(error);
  }
};

export const getShopById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ID',
        message: shopErrors.retrieval.invalidId
      });
    }
    
    // Vérifier si la boutique existe
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ 
        status: 'error',
        code: 'SHOP_NOT_FOUND',
        message: shopErrors.retrieval.notFound
      });
    }

    // Récupérer les produits de cette boutique
    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: {
        images: true
      }
    });

    return res.status(200).json({
      status: 'success',
      message: "Boutique récupérée avec succès",
      shop,
      products
    });
  } catch (error) {
    next(error);
  }
};

export const updateShop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ID',
        message: shopErrors.retrieval.invalidId
      });
    }
    
    const { name, description, phoneNumber, address } = req.body;
    const userId = req.user.id;
    
    // Vérifier si la boutique existe et appartient à l'utilisateur
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ 
        status: 'error',
        code: 'SHOP_NOT_FOUND',
        message: shopErrors.retrieval.notFound
      });
    }
    
    if (shop.userId !== userId) {
      return res.status(403).json({ 
        status: 'error',
        code: 'NOT_AUTHORIZED',
        message: shopErrors.update.notAuthorized
      });
    }
    
    // Traitement du logo avec Cloudinary
    let logoUrl = shop.logo;
    
    if (req.file) {
      try {
        // Si un logo existe déjà, le supprimer de Cloudinary
        if (shop.logo && shop.logo.includes('cloudinary.com')) {
          try {
            // Extraire l'ID public de l'URL Cloudinary
            const publicId = shop.logo.split('/').pop().split('.')[0];
            if (publicId) {
              await cloudinary.uploader.destroy(`shop_logos/${publicId}`);
            }
          } catch (deleteError) {
            console.error('Erreur lors de la suppression de l\'ancien logo:', deleteError);
            // Continuer malgré l'erreur
          }
        }
        
        // Upload du nouveau logo vers Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'shop_logos',
          use_filename: true,
          unique_filename: true,
        });
        
        logoUrl = result.secure_url;
        
        // Supprimer le fichier temporaire
        fs.unlinkSync(req.file.path);
      } catch (cloudinaryError) {
        console.error('Erreur lors de l\'upload du logo vers Cloudinary:', cloudinaryError);
        return next({
          name: 'CloudinaryError',
          message: shopErrors.update.uploadFailed,
          details: cloudinaryError.message,
          status: 500
        });
      }
    }
    
    // Mettre à jour la boutique avec les nouvelles données
    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        name: name || shop.name,
        description: description || shop.description,
        phoneNumber: phoneNumber || shop.phoneNumber,
        address: address || shop.address,
        logo: logoUrl
      }
    });
  
    return res.status(200).json({
      status: 'success',
      message: "Boutique mise à jour avec succès",
      shop: updatedShop
    });
  } catch (error) {
    // Gestion spécifique de l'erreur de numéro de téléphone en double
    if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
      return res.status(400).json({ 
        status: 'error',
        code: 'PHONE_EXISTS',
        message: shopErrors.update.phoneNumberExists
      });
    }
    
    next(error);
  }
};

export const getAllShops = async (req, res, next) => {
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
    
    return res.status(200).json({
      status: 'success',
      message: shops.length > 0 ? "Liste des boutiques récupérée avec succès" : "Aucune boutique disponible",
      shops
    });
  } catch (error) {
    next(error);
  }
};

export const deleteShop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ID',
        message: shopErrors.retrieval.invalidId
      });
    }
    
    const userId = req.user.id;
    
    // Vérifier si la boutique existe et appartient à l'utilisateur
    const shop = await prisma.shop.findUnique({
      where: { id: shopId }
    });
    
    if (!shop) {
      return res.status(404).json({ 
        status: 'error',
        code: 'SHOP_NOT_FOUND',
        message: shopErrors.retrieval.notFound
      });
    }
    
    if (shop.userId !== userId) {
      return res.status(403).json({ 
        status: 'error',
        code: 'NOT_AUTHORIZED',
        message: shopErrors.deletion.notAuthorized
      });
    }
    
    // Supprimer le logo de la boutique de Cloudinary si présent
    if (shop.logo && shop.logo.includes('cloudinary.com')) {
      try {
        // Extraire l'ID public de l'URL Cloudinary
        const publicId = shop.logo.split('/').pop().split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`shop_logos/${publicId}`);
        }
      } catch (cloudinaryError) {
        console.error('Erreur lors de la suppression du logo:', cloudinaryError);
        // Continuer malgré l'erreur
      }
    }
    
    // Récupérer et supprimer les images des produits de Cloudinary
    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: { images: true }
    });
    
    // Supprimer toutes les images de produit de Cloudinary
    for (const product of products) {
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          if (image.url && image.url.includes('cloudinary.com')) {
            try {
              const publicId = image.url.split('/').pop().split('.')[0];
              if (publicId) {
                await cloudinary.uploader.destroy(`product_images/${publicId}`);
              }
            } catch (cloudinaryError) {
              console.error('Erreur lors de la suppression d\'une image de produit:', cloudinaryError);
              // Continuer malgré l'erreur
            }
          }
        }
      }
    }
    
    // Supprimer d'abord les images de produit
    await prisma.productImage.deleteMany({
      where: {
        product: {
          shopId: shopId
        }
      }
    });
    
    // Supprimer ensuite les produits
    await prisma.product.deleteMany({
      where: { shopId: shopId }
    });
    
    // Supprimer la boutique
    await prisma.shop.delete({
      where: { id: shopId }
    });
    
    return res.status(200).json({
      status: 'success',
      message: "Boutique et tous ses produits supprimés avec succès"
    });
  } catch (error) {
    next(error);
  }
};

export const getShopWithMerchantDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (isNaN(shopId)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ID',
        message: shopErrors.retrieval.invalidId
      });
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
            phoneNumber: true,
            photo: true,
            createdAt: true,
          }
        }
      }
    });
    
    if (!shop) {
      return res.status(404).json({ 
        status: 'error',
        code: 'SHOP_NOT_FOUND',
        message: shopErrors.retrieval.notFound
      });
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
    };

    return res.status(200).json({
      status: 'success',
      message: "Informations de la boutique et du commerçant récupérées avec succès",
      shop,
      products,
      merchantStats
    });
  } catch (error) {
    next(error);
  }
};

export const contactMerchant = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        code: 'NOT_AUTHENTICATED',
        message: shopErrors.contact.notAuthenticated
      });
    }

    const { shopId } = req.params;
    const { subject, message } = req.body;
    
    // Récupérer les informations de l'utilisateur connecté
    const { id: userId, email, firstName, lastName } = req.user;

    // Validation des entrées
    if (!subject || !message) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: shopErrors.contact.missingFields
      });
    }

    // Conversion du shopId en nombre et vérification
    const shopIdInt = parseInt(shopId, 10);
    if (isNaN(shopIdInt)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_ID',
        message: shopErrors.retrieval.invalidId
      });
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
      return res.status(404).json({ 
        status: 'error',
        code: 'SHOP_NOT_FOUND',
        message: shopErrors.retrieval.notFound
      });
    }

    // Vérifier que l'utilisateur ne contacte pas sa propre boutique
    if (shop.owner.id === userId) {
      return res.status(400).json({ 
        status: 'error',
        code: 'SELF_CONTACT',
        message: shopErrors.contact.selfContact
      });
    }

    // Créer le message de contact dans la base de données
    const contactMessage = await prisma.merchantContact.create({
      data: {
        shopId: shopIdInt,
        merchantId: shop.owner.id,
        subject,
        senderEmail: email,
        message,
        status: 'UNREAD'
      }
    });

    // Envoyer l'email au commerçant
    try {
      await sendContactMerchantEmail(
        shop.owner.email,
        subject,
        email,
        message,
        shop.name
      );
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi du mail au commerçant:', emailError);
      // Continuer malgré l'erreur d'email
    }

    // Créer une notification pour le commerçant
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
        email,
        subject,
        shop.name,
        shop.owner.firstName
      );
    } catch (emailError) {
      console.error("Erreur email de confirmation :", emailError);
      // Continuer malgré l'erreur d'email de confirmation
    }

    return res.status(200).json({
      status: 'success',
      message: "Votre message a été envoyé avec succès au commerçant",
      contact: {
        id: contactMessage.id,
        createdAt: contactMessage.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const respondToContactMessage = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 'NOT_AUTHENTICATED',
        message: shopErrors.contact.notAuthenticated
      });
    }

    const { contactId } = req.params;
    const { response } = req.body;

    // Validation des entrées
    if (!response) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_RESPONSE',
        message: shopErrors.contact.missingResponse
      });
    }

    // Convertir contactId en nombre
    const contactIdInt = parseInt(contactId, 10);
    if (isNaN(contactIdInt)) {
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_MESSAGE_ID',
        message: shopErrors.contact.invalidMessageId
      });
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
      return res.status(404).json({ 
        status: 'error',
        code: 'MESSAGE_NOT_FOUND',
        message: "Message de contact non trouvé"
      });
    }

    // Vérifier que l'utilisateur connecté est bien le propriétaire de la boutique
    if (originalContact.shop.owner.id !== req.user.id) {
      return res.status(403).json({ 
        status: 'error',
        code: 'NOT_AUTHORIZED_TO_RESPOND',
        message: shopErrors.contact.responseNotAuthorized
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
    try {
      await sendResponseEmail(
        originalContact.senderEmail,
        originalContact.subject,
        response,
        originalContact.shop.name
      );
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de réponse:', emailError);
      // Continuer malgré l'erreur d'email
    }

    // Créer une notification pour l'utilisateur
    try {
      await createNotification({
        userId: originalContact.senderId, // ID de l'utilisateur qui a envoyé le message
        type: "MESSAGE_RESPONSE",
        message: `Le commerçant a répondu à votre message concernant la boutique ${originalContact.shop.name}`,
        resourceId: contactResponse.id,
        resourceType: "MerchantContactResponse",
        redirectUrl: `/dashboard/messages/${contactResponse.id}`,
        priority: 1
      });
    } catch (notifError) {
      console.error('Erreur lors de la création de la notification:', notifError);
      // Continuer malgré l'erreur de notification
    }

    return res.status(200).json({
      status: 'success',
      message: "Votre réponse a été envoyée avec succès",
      response: {
        id: contactResponse.id,
        createdAt: contactResponse.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUserMessages = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        code: 'NOT_AUTHENTICATED',
        message: shopErrors.contact.notAuthenticated
      });
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
      status: 'success',
      messages,
      totalCount: messages.length
    });
  } catch (error) {
    next(error);
  }
};
// Convertir le fichier en utilisant ES Modules
import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';
import cloudinary from '../utils/cloudinary.js';
import { productErrors } from '../utils/errorMessages.js';


import fs from 'fs';
const prisma = new PrismaClient();

// Exporter chaque fonction individuellement en utilisant des exports nommés

export const createProduct = async (req, res) => {
  try {
    console.log("\n🛍️ === DÉBUT CRÉATION PRODUIT ===");
    console.log("📝 Données reçues :", req.body);
    console.log("📁 Fichiers reçus :", req.files);
    console.log("👤 Utilisateur ID :", req.user?.id);

    const { name, description, price, stock, videoUrl, category, status } = req.body;
    const userId = req.user.id;

    // ✅ VALIDATION DES DONNÉES D'ENTRÉE
    if (!name || !description || !price || !stock || !category) {
      console.log("❌ Données manquantes:", { name: !!name, description: !!description, price: !!price, stock: !!stock, category: !!category });
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Champs requis manquants',
        details: 'Nom, description, prix, stock et catégorie sont obligatoires'
      });
    }

    // Vérifier si l'utilisateur existe et possède une boutique
    console.log("🔍 Recherche de l'utilisateur et de sa boutique...");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shop: true }
    });

    if (!user) {
      console.log("❌ Utilisateur non trouvé");
      return res.status(404).json({ 
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: productErrors.userNotFound 
      });
    }

    console.log("✅ Utilisateur trouvé:", { id: user.id, role: user.role, hasShop: !!user.shop });

    if (user.role !== "MERCHANT") {
      console.log("❌ Utilisateur n'est pas un marchand");
      return res.status(403).json({ 
        status: 'error',
        code: 'NOT_MERCHANT',
        message: productErrors.notMerchant 
      });
    }

    if (!user.shop) {
      console.log("❌ Utilisateur n'a pas de boutique");
      return res.status(403).json({ 
        status: 'error',
        code: 'NO_SHOP',
        message: productErrors.noShop 
      });
    }

    // Vérifier si price et stock sont valides
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      console.log("❌ Prix invalide:", price);
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_PRICE',
        message: 'Le prix doit être un nombre positif',
        details: `Valeur reçue: ${price}`
      });
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      console.log("❌ Stock invalide:", stock);
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_STOCK',
        message: 'Le stock doit être un nombre entier positif ou zéro',
        details: `Valeur reçue: ${stock}`
      });
    }

    console.log("✅ Validation des données réussie:", { parsedPrice, parsedStock });

    // Déterminer le statut (par défaut DRAFT si non spécifié)
    const productStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    console.log("📊 Statut du produit:", productStatus);

    // ✅ GESTION AMÉLIORÉE DE LA VIDÉO
    let finalVideoUrl = videoUrl;
    console.log("🎥 Traitement de la vidéo...");
    
    if (req.files && req.files.video && req.files.video[0]) {
      const videoFile = req.files.video[0];
      console.log("📹 Fichier vidéo détecté:", {
        filename: videoFile.filename,
        originalname: videoFile.originalname,
        mimetype: videoFile.mimetype,
        size: `${(videoFile.size / (1024 * 1024)).toFixed(2)}MB`
      });

      try {
        console.log("☁️ Upload de la vidéo vers Cloudinary...");
        const videoResult = await cloudinary.uploader.upload(videoFile.path, {
          resource_type: "video",
          folder: "product_videos",
          use_filename: true,
          unique_filename: true,
        });
        
        finalVideoUrl = videoResult.secure_url;
        console.log("✅ Vidéo uploadée avec succès:", finalVideoUrl);
        
        // Supprimer le fichier temporaire
        if (fs.existsSync(videoFile.path)) {
          fs.unlinkSync(videoFile.path);
          console.log("🗑️ Fichier temporaire vidéo supprimé");
        }
      } catch (cloudinaryError) {
        console.error('❌ Erreur lors de l\'upload de la vidéo vers Cloudinary:', cloudinaryError);
        return res.status(500).json({
          status: 'error',
          code: 'VIDEO_UPLOAD_FAILED',
          message: 'Échec de l\'upload de la vidéo',
          details: cloudinaryError.message
        });
      }
    } else if (videoUrl) {
      console.log("🔗 URL de vidéo fournie:", videoUrl);
      finalVideoUrl = videoUrl;
    } else {
      console.log("📹 Aucune vidéo fournie");
    }

    // ✅ CRÉATION DU PRODUIT AVEC MEILLEUR LOGGING
    console.log("🏗️ Création du produit en base de données...");
    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      stock: parsedStock,
      videoUrl: finalVideoUrl,
      category: category.trim(),
      status: productStatus,
      shopId: user.shop.id,
      userId
    };
    
    console.log("📦 Données du produit:", productData);

    const newProduct = await prisma.product.create({
      data: productData
    });

    console.log("✅ Produit créé avec l'ID:", newProduct.id);

    // ✅ GESTION AMÉLIORÉE DES IMAGES
    let productImages = [];
    let imageUploadErrors = [];
    
    console.log("🖼️ Traitement des images...");
    
    if (req.files && req.files.productImages && req.files.productImages.length > 0) {
      console.log(`📸 ${req.files.productImages.length} image(s) à traiter`);
      
      for (let i = 0; i < req.files.productImages.length; i++) {
        const file = req.files.productImages[i];
        console.log(`🖼️ Traitement image ${i + 1}:`, {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: `${(file.size / 1024).toFixed(2)}KB`
        });

        try {
          console.log(`☁️ Upload image ${i + 1} vers Cloudinary...`);
          const imageResult = await cloudinary.uploader.upload(file.path, {
            folder: 'product_images',
            use_filename: true,
            unique_filename: true,
          });
          
          productImages.push({
            productId: newProduct.id,
            imageUrl: imageResult.secure_url
          });
          
          console.log(`✅ Image ${i + 1} uploadée:`, imageResult.secure_url);
          
          // Supprimer le fichier temporaire
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Fichier temporaire image ${i + 1} supprimé`);
          }
        } catch (cloudinaryError) {
          console.error(`❌ Erreur upload image ${i + 1}:`, cloudinaryError);
          imageUploadErrors.push(`Image ${file.originalname}: ${cloudinaryError.message}`);
          
          // Supprimer le fichier temporaire même en cas d'erreur
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      
      // Créer les entrées d'images en base de données
      if (productImages.length > 0) {
        console.log(`💾 Sauvegarde de ${productImages.length} image(s) en base...`);
        await prisma.productImage.createMany({
          data: productImages
        });
        console.log("✅ Images sauvegardées en base de données");
      }
      
      if (imageUploadErrors.length > 0) {
        console.log("⚠️ Erreurs d'upload d'images:", imageUploadErrors);
      }
    } else {
      console.log("🖼️ Aucune image fournie");
    }

    // ✅ NOTIFICATIONS POUR PRODUIT PUBLIÉ
    if (productStatus === 'PUBLISHED') {
      console.log("📢 Envoi de notifications aux abonnés...");
      
      try {
        // Trouver tous les abonnés du vendeur
        const subscribers = await prisma.subscription.findMany({
          where: { followingId: userId },
          select: { followerId: true }
        });
        
        console.log(`👥 ${subscribers.length} abonné(s) trouvé(s)`);
        
        if (subscribers.length > 0) {
          // Obtenir les informations du vendeur
          const merchant = {
            firstName: user.firstName || 'Marchand',
            lastName: user.lastName || ''
          };
          
          // Créer une notification pour chaque abonné
          for (const subscriber of subscribers) {
            await createNotification({
              userId: subscriber.followerId,
              type: 'PRODUCT',
              message: `${merchant.firstName} ${merchant.lastName} a publié un nouveau produit: ${newProduct.name}`,
              actionUrl: `/products/${newProduct.id}`,
              resourceId: newProduct.id,
              resourceType: 'Product',
              priority: 2
            });
          }
          
          console.log(`✅ ${subscribers.length} notification(s) envoyée(s)`);
        }
      } catch (notificationError) {
        console.error("❌ Erreur lors de l'envoi des notifications:", notificationError);
        // Ne pas faire échouer la création du produit pour une erreur de notification
      }
    }

    // ✅ RÉCUPÉRATION DU PRODUIT FINAL AVEC SES RELATIONS
    console.log("📦 Récupération du produit final...");
    const productWithImages = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { 
        images: true,
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log("✅ === CRÉATION PRODUIT TERMINÉE ===");
    console.log("📊 Résumé:", {
      productId: productWithImages.id,
      name: productWithImages.name,
      status: productWithImages.status,
      imagesCount: productWithImages.images.length,
      hasVideo: !!productWithImages.videoUrl,
      imageErrors: imageUploadErrors.length
    });

    const response = {
      status: 'success',
      message: "Produit créé avec succès",
      product: productWithImages
    };

    // Ajouter les avertissements d'images si nécessaire
    if (imageUploadErrors.length > 0) {
      response.warnings = {
        imageUploadErrors,
        message: `${imageUploadErrors.length} image(s) n'ont pas pu être uploadées`
      };
    }

    return res.status(201).json(response);

  } catch (error) {
    console.error("\n❌ === ERREUR CRÉATION PRODUIT ===");
    console.error("💥 Erreur lors de la création du produit :", error);
    console.error("📍 Stack trace:", error.stack);
    
    // Nettoyer les fichiers temporaires en cas d'erreur
    if (req.files) {
      console.log("🧹 Nettoyage des fichiers temporaires...");
      Object.keys(req.files).forEach(fieldName => {
        req.files[fieldName].forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Fichier supprimé: ${file.path}`);
          }
        });
      });
    }
    
    return res.status(500).json({
      status: 'error',
      code: 'CREATION_FAILED',
      message: 'Erreur lors de la création du produit',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur inattendue s\'est produite'
    });
  }
};
// Fonction pour ajouter des images à un produit existant
// Fonction pour ajouter des images à un produit existant
export const addProductImages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier si le produit existe et appartient à l'utilisateur
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id, 10),
        userId
      }
    });

    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        code: 'PRODUCT_NOT_FOUND',
        message: productErrors.notFound 
      });
    }

    // Ajouter les images via Cloudinary
    if (req.files && req.files.length > 0) {
      const productImages = [];
      
      for (const file of req.files) {
        try {
          // Upload de l'image vers Cloudinary
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'product_images',
            use_filename: true,
            unique_filename: true,
          });
          
          productImages.push({
            productId: product.id,
            imageUrl: result.secure_url
          });
          
          // Supprimer le fichier temporaire
          fs.unlinkSync(file.path);
        } catch (cloudinaryError) {
          console.error('Erreur lors de l\'upload d\'une image vers Cloudinary:', cloudinaryError);
          // Continuer avec les autres images malgré l'erreur
        }
      }
      
      // Créer les entrées d'images en base de données si des uploads ont réussi
      if (productImages.length > 0) {
        await prisma.productImage.createMany({
          data: productImages
        });
      } else {
        return res.status(400).json({ 
          status: 'error',
          code: 'UPLOAD_FAILED',
          message: productErrors.uploadFailed 
        });
      }
    } else {
      return res.status(400).json({ 
        status: 'error',
        code: 'NO_IMAGES',
        message: productErrors.noImages 
      });
    }

    // Récupérer le produit mis à jour avec ses images
    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true }
    });

    return res.status(200).json({
      status: 'success',
      message: "Images ajoutées avec succès",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout des images :", error);
    return res.status(500).json({
      status: 'error',
      code: 'UPLOAD_FAILED',
      message: productErrors.uploadFailed,
      error: error.message
    });
  }
};

// Fonction pour ajouter/modifier la vidéo d'un produit
export const addProductVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { videoUrl } = req.body;

    // Vérifier si le produit existe et appartient à l'utilisateur
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id, 10),
        userId
      }
    });

    if (!product) {
      return res.status(404).json({ 
        status: 'error',
        code: 'PRODUCT_NOT_FOUND',
        message: productErrors.notFound 
      });
    }

    // Déterminer l'URL de la vidéo (fichier uploadé ou URL externe)
    let finalVideoUrl = videoUrl;
    
    if (req.file) {
      try {
        // Si le produit a déjà une vidéo et qu'elle est sur Cloudinary, la supprimer
        if (product.videoUrl && product.videoUrl.includes('cloudinary.com')) {
          try {
            const publicId = product.videoUrl.split('/').pop().split('.')[0];
            if (publicId) {
              await cloudinary.uploader.destroy(`product_videos/${publicId}`, {
                resource_type: "video"
              });
            }
          } catch (deleteError) {
            console.error('Erreur lors de la suppression de l\'ancienne vidéo:', deleteError);
            // Continuer malgré l'erreur
          }
        }
        
        // Upload de la nouvelle vidéo vers Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video",
          folder: "product_videos",
          use_filename: true,
          unique_filename: true,
        });
        
        finalVideoUrl = result.secure_url;
        
        // Supprimer le fichier temporaire
        fs.unlinkSync(req.file.path);
      } catch (cloudinaryError) {
        console.error('Erreur lors de l\'upload de la vidéo vers Cloudinary:', cloudinaryError);
        return res.status(500).json({
          status: 'error',
          code: 'VIDEO_UPLOAD_FAILED',
          message: productErrors.videoUploadFailed,
          details: cloudinaryError.message
        });
      }
    }

    if (!finalVideoUrl) {
      return res.status(400).json({ 
        status: 'error',
        code: 'NO_VIDEO',
        message: "Aucune vidéo ou URL de vidéo fournie" 
      });
    }

    // Mettre à jour l'URL de la vidéo
    await prisma.product.update({
      where: { id: product.id },
      data: { videoUrl: finalVideoUrl }
    });

    // Récupérer le produit mis à jour
    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true }
    });

    return res.status(200).json({
      status: 'success',
      message: "Vidéo ajoutée avec succès",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout de la vidéo :", error);
    return res.status(500).json({
      status: 'error',
      code: 'VIDEO_UPLOAD_FAILED',
      message: productErrors.videoUploadFailed,
      error: error.message
    });
  }
};
export const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    
    // Vérifier si le nouveau statut est valide
    if (status !== 'DRAFT' && status !== 'PUBLISHED') {
      return res.status(400).json({
        message: "Le statut doit être 'DRAFT' ou 'PUBLISHED'"
      });
    }
    
    // Vérifier si le produit existe et si l'utilisateur est le propriétaire
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    if (product.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à modifier ce produit"
      });
    }
    
    // Mettre à jour le statut du produit
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        status,
        updatedAt: new Date()
      }
    });
    
    // Si nous publions le produit, créer une notification pour les abonnés
    if (status === 'PUBLISHED' && product.status === 'DRAFT') {
      // Trouver tous les abonnés du vendeur
      const subscribers = await prisma.subscription.findMany({
        where: { followingId: userId },
        select: { followerId: true }
      });
      
      // Créer une notification pour chaque abonné
      if (subscribers.length > 0) {
        const notifications = subscribers.map(sub => ({
          userId: sub.followerId,
          type: 'PRODUCT',
          message: `Nouveau produit disponible: ${updatedProduct.name}`,
          actionUrl: `/products/${updatedProduct.id}`,
          resourceId: updatedProduct.id,
          resourceType: 'Product'
        }));
        
        await prisma.notification.createMany({
          data: notifications
        });
      }
    }
    
    return res.status(200).json({
      message: status === 'PUBLISHED' 
        ? "Produit publié avec succès" 
        : "Produit sauvegardé en brouillon",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut du produit:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du statut",
      error: error.message
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const { 
      category, 
      minPrice, 
      maxPrice, 
      sortBy, 
      order, 
      page = 1, 
      limit = 10,
      status = 'PUBLISHED' // Par défaut, ne montrer que les produits publiés
    } = req.query;
    
    // Construire les filtres
    const filters = {
      status: status // Filtrer par statut
    };
    
    if (category) {
      filters.category = category;
    }
    
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.gte = parseFloat(minPrice);
      if (maxPrice) filters.price.lte = parseFloat(maxPrice);
    }
    
    // Construire l'ordre de tri
    const orderBy = {};
    if (sortBy) {
      orderBy[sortBy] = order?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.createdAt = 'desc'; // Par défaut, les plus récents d'abord
    }
    
    // Calculer le nombre d'éléments à sauter
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Récupérer les produits
    const products = await prisma.product.findMany({
      where: filters,
      orderBy,
      skip,
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        },
        // Inclure les compteurs d'interactions sociales
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true
          }
        }
      }
    });
    
    // Compter le nombre total de produits pour la pagination
    const totalProducts = await prisma.product.count({ where: filters });
    
    return res.status(200).json({
      products,
      pagination: {
        total: totalProducts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalProducts / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des produits:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des produits",
      error: error.message
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        images: true,
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
            verifiedBadge: true,
            phoneNumber: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photo: true
              }
            }
          }
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    return res.status(200).json(product);
  } catch (error) {
    console.error("Erreur lors de la récupération du produit:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération du produit",
      error: error.message
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      stock,
      videoUrl,
      category,
      images
    } = req.body;
    
    const userId = req.user.id;
    
    // Vérifier si le produit existe et si l'utilisateur est le propriétaire
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { images: true }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    if (product.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à modifier ce produit"
      });
    }
    
    // Mettre à jour le produit
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        stock: stock ? parseInt(stock) : undefined,
        videoUrl,
        category,
        updatedAt: new Date()
      }
    });
    
    // Gérer les images si elles ont été fournies
    if (images && images.length > 0) {
      // Supprimer les anciennes images
      await prisma.productImage.deleteMany({
        where: { productId: parseInt(id) }
      });
      
      // Ajouter les nouvelles images
      const productImages = images.map(imageUrl => ({
        productId: parseInt(id),
        imageUrl
      }));
      
      await prisma.productImage.createMany({
        data: productImages
      });
    }
    
    // Récupérer le produit mis à jour avec ses images
    const productWithImages = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { images: true }
    });
    
    return res.status(200).json({
      message: "Produit mis à jour avec succès",
      product: productWithImages
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du produit:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du produit",
      error: error.message
    });
  }
};
// 📄 À AJOUTER dans productController.js après les autres fonctions

export const updateProductWithImages = async (req, res) => {
  try {
    console.log("\n🔧 === DÉBUT MISE À JOUR PRODUIT AVEC IMAGES ===");
    console.log("📝 Données reçues :", req.body);
    console.log("📁 Fichiers reçus :", req.files);
    console.log("👤 Utilisateur ID :", req.user?.id);

    const { id } = req.params;
    const { 
      name, 
      description, 
      category, 
      price, 
      stock, 
      videoUrl,
      existingImageUrls,  // Images à conserver (JSON string)
      imagesToDelete      // Images à supprimer (JSON string)
    } = req.body;
    const userId = req.user.id;
    
    console.log(`🔧 === MISE À JOUR PRODUIT ${id} ===`);
    console.log('📋 Données reçues:');
    console.log('  • Nom:', name);
    console.log('  • Nouvelles images:', req.files?.productImages?.length || 0);
    console.log('  • Images à conserver:', existingImageUrls ? 'Présent' : 'Absent');
    console.log('  • Images à supprimer:', imagesToDelete ? 'Présent' : 'Absent');

    // ✅ ÉTAPE 1: Vérifier si le produit existe et appartient à l'utilisateur
    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { images: true }
    });

    if (!existingProduct) {
      console.log("❌ Produit non trouvé");
      return res.status(404).json({ 
        status: 'error',
        code: 'PRODUCT_NOT_FOUND',
        message: "Produit non trouvé" 
      });
    }

    if (existingProduct.userId !== userId) {
      console.log("❌ Utilisateur non autorisé");
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: "Vous n'êtes pas autorisé à modifier ce produit"
      });
    }

    console.log("✅ Produit trouvé et autorisé:", { 
      id: existingProduct.id, 
      name: existingProduct.name,
      currentImages: existingProduct.images.length 
    });

    // ✅ ÉTAPE 2: Parser les listes d'images
    let imagesToKeep = [];
    let imagesToRemove = [];
    
    try {
      imagesToKeep = existingImageUrls ? JSON.parse(existingImageUrls) : [];
      imagesToRemove = imagesToDelete ? JSON.parse(imagesToDelete) : [];
    } catch (parseError) {
      console.error('❌ Erreur parsing images:', parseError);
      return res.status(400).json({ 
        status: 'error',
        code: 'INVALID_JSON',
        message: "Format des données d'images invalide" 
      });
    }

    console.log('📸 Images à conserver:', imagesToKeep.length);
    console.log('🗑️ Images à supprimer:', imagesToRemove.length);

    // ✅ ÉTAPE 3: Supprimer les images marquées pour suppression
    if (imagesToRemove.length > 0) {
      console.log('🗑️ Suppression des images de la base de données...');
      
      try {
        // Supprimer de la base de données
        const deleteResult = await prisma.productImage.deleteMany({
          where: {
            productId: parseInt(id),
            imageUrl: { in: imagesToRemove }
          }
        });

        console.log(`✅ ${deleteResult.count} images supprimées de la base`);

        // ✅ OPTIONNEL: Supprimer aussi de Cloudinary
        for (const imageUrl of imagesToRemove) {
          try {
            if (imageUrl.includes('cloudinary')) {
              // Extraire l'ID public de Cloudinary
              const urlParts = imageUrl.split('/');
              const fileNameWithExt = urlParts[urlParts.length - 1];
              const publicId = `product_images/${fileNameWithExt.split('.')[0]}`;
              
              // Supprimer de Cloudinary
              await cloudinary.uploader.destroy(publicId);
              console.log(`🗑️ Image supprimée de Cloudinary: ${publicId}`);
            }
          } catch (cloudinaryError) {
            console.error('⚠️ Erreur suppression Cloudinary:', cloudinaryError);
            // Ne pas faire échouer la requête pour une erreur Cloudinary
          }
        }
        
        console.log(`✅ ${imagesToRemove.length} images traitées pour suppression`);
      } catch (dbError) {
        console.error('❌ Erreur suppression base de données:', dbError);
        return res.status(500).json({
          status: 'error',
          code: 'DELETE_IMAGES_FAILED',
          message: 'Erreur lors de la suppression des images'
        });
      }
    }

    // ✅ ÉTAPE 4: Traiter les nouvelles images
    let newImageUrls = [];
    let imageUploadErrors = [];

    if (req.files && req.files.productImages && req.files.productImages.length > 0) {
      console.log(`📸 Upload de ${req.files.productImages.length} nouvelles images...`);
      
      for (let i = 0; i < req.files.productImages.length; i++) {
        const file = req.files.productImages[i];
        console.log(`🖼️ Traitement nouvelle image ${i + 1}:`, {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: `${(file.size / 1024).toFixed(2)}KB`
        });

        try {
          console.log(`☁️ Upload nouvelle image ${i + 1} vers Cloudinary...`);
          const imageResult = await cloudinary.uploader.upload(file.path, {
            folder: 'product_images',
            use_filename: true,
            unique_filename: true,
          });
          
          newImageUrls.push(imageResult.secure_url);
          console.log(`✅ Nouvelle image ${i + 1} uploadée:`, imageResult.secure_url);
          
          // Supprimer le fichier temporaire
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Fichier temporaire ${i + 1} supprimé`);
          }
        } catch (cloudinaryError) {
          console.error(`❌ Erreur upload nouvelle image ${i + 1}:`, cloudinaryError);
          imageUploadErrors.push(`Image ${file.originalname}: ${cloudinaryError.message}`);
          
          // Supprimer le fichier temporaire même en cas d'erreur
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      
      console.log(`📊 Résultat upload: ${newImageUrls.length} réussies, ${imageUploadErrors.length} échouées`);
    }

    // ✅ ÉTAPE 5: Ajouter les nouvelles images en base
    if (newImageUrls.length > 0) {
      console.log(`💾 Sauvegarde de ${newImageUrls.length} nouvelle(s) image(s) en base...`);
      
      const imageData = newImageUrls.map(url => ({
        productId: parseInt(id),
        imageUrl: url
      }));

      try {
        await prisma.productImage.createMany({
          data: imageData
        });
        console.log(`✅ ${newImageUrls.length} nouvelles images ajoutées en base`);
      } catch (dbError) {
        console.error('❌ Erreur ajout images en base:', dbError);
        return res.status(500).json({
          status: 'error',
          code: 'ADD_IMAGES_FAILED',
          message: 'Erreur lors de l\'ajout des nouvelles images'
        });
      }
    }

    // ✅ ÉTAPE 6: Gestion de la vidéo (similaire à createProduct)
    let finalVideoUrl = videoUrl;
    console.log("🎥 Traitement de la vidéo...");
    
    if (req.files && req.files.video && req.files.video[0]) {
      const videoFile = req.files.video[0];
      console.log("📹 Fichier vidéo détecté:", {
        filename: videoFile.filename,
        originalname: videoFile.originalname,
        mimetype: videoFile.mimetype,
        size: `${(videoFile.size / (1024 * 1024)).toFixed(2)}MB`
      });

      try {
        // Supprimer l'ancienne vidéo de Cloudinary si elle existe
        if (existingProduct.videoUrl && existingProduct.videoUrl.includes('cloudinary')) {
          try {
            const oldVideoPublicId = existingProduct.videoUrl.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`product_videos/${oldVideoPublicId}`, {
              resource_type: "video"
            });
            console.log("🗑️ Ancienne vidéo supprimée de Cloudinary");
          } catch (deleteError) {
            console.error('⚠️ Erreur suppression ancienne vidéo:', deleteError);
          }
        }

        console.log("☁️ Upload de la nouvelle vidéo vers Cloudinary...");
        const videoResult = await cloudinary.uploader.upload(videoFile.path, {
          resource_type: "video",
          folder: "product_videos",
          use_filename: true,
          unique_filename: true,
        });
        
        finalVideoUrl = videoResult.secure_url;
        console.log("✅ Nouvelle vidéo uploadée:", finalVideoUrl);
        
        // Supprimer le fichier temporaire
        if (fs.existsSync(videoFile.path)) {
          fs.unlinkSync(videoFile.path);
          console.log("🗑️ Fichier temporaire vidéo supprimé");
        }
      } catch (cloudinaryError) {
        console.error('❌ Erreur upload vidéo:', cloudinaryError);
        return res.status(500).json({
          status: 'error',
          code: 'VIDEO_UPLOAD_FAILED',
          message: 'Échec de l\'upload de la vidéo',
          details: cloudinaryError.message
        });
      }
    } else if (videoUrl !== undefined) {
      console.log("🔗 URL de vidéo mise à jour:", videoUrl);
      finalVideoUrl = videoUrl;
    } else {
      console.log("📹 Vidéo inchangée");
      finalVideoUrl = existingProduct.videoUrl;
    }

    // ✅ ÉTAPE 7: Mettre à jour les autres informations du produit
    console.log("📝 Mise à jour des informations du produit...");
    
    // Valider price et stock si fournis
    let parsedPrice = existingProduct.price;
    let parsedStock = existingProduct.stock;

    if (price !== undefined) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        console.log("❌ Prix invalide:", price);
        return res.status(400).json({ 
          status: 'error',
          code: 'INVALID_PRICE',
          message: 'Le prix doit être un nombre positif',
          details: `Valeur reçue: ${price}`
        });
      }
    }

    if (stock !== undefined) {
      parsedStock = parseInt(stock);
      if (isNaN(parsedStock) || parsedStock < 0) {
        console.log("❌ Stock invalide:", stock);
        return res.status(400).json({ 
          status: 'error',
          code: 'INVALID_STOCK',
          message: 'Le stock doit être un nombre entier positif ou zéro',
          details: `Valeur reçue: ${stock}`
        });
      }
    }

    const updateData = {
      updatedAt: new Date()
    };

    // Ajouter les champs modifiés seulement
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (price !== undefined) updateData.price = parsedPrice;
    if (stock !== undefined) updateData.stock = parsedStock;
    if (finalVideoUrl !== existingProduct.videoUrl) updateData.videoUrl = finalVideoUrl;

    console.log("📋 Données de mise à jour:", updateData);

    try {
      const updatedProduct = await prisma.product.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          images: true,
          shop: {
            select: { name: true, id: true }
          }
        }
      });

      console.log('✅ Produit mis à jour avec succès');
      console.log(`📸 Total images finales: ${updatedProduct.images.length}`);

      const response = {
        status: 'success',
        message: "Produit mis à jour avec succès",
        product: updatedProduct,
        stats: {
          imagesConservees: imagesToKeep.length,
          imagesSupprimees: imagesToRemove.length,
          nouvellesImages: newImageUrls.length,
          totalFinal: updatedProduct.images.length
        }
      };

      // Ajouter les avertissements d'images si nécessaire
      if (imageUploadErrors.length > 0) {
        response.warnings = {
          imageUploadErrors,
          message: `${imageUploadErrors.length} image(s) n'ont pas pu être uploadées`
        };
      }

      console.log("✅ === MISE À JOUR PRODUIT TERMINÉE ===");
      console.log("📊 Résumé:", {
        productId: updatedProduct.id,
        name: updatedProduct.name,
        imagesConservees: imagesToKeep.length,
        imagesSupprimees: imagesToRemove.length,
        nouvellesImages: newImageUrls.length,
        totalFinal: updatedProduct.images.length,
        imageErrors: imageUploadErrors.length
      });

      return res.status(200).json(response);

    } catch (updateError) {
      console.error('❌ Erreur mise à jour produit:', updateError);
      return res.status(500).json({
        status: 'error',
        code: 'UPDATE_FAILED',
        message: 'Erreur lors de la mise à jour du produit',
        details: updateError.message
      });
    }

  } catch (error) {
    console.error("\n❌ === ERREUR MISE À JOUR PRODUIT ===");
    console.error("💥 Erreur lors de la mise à jour du produit :", error);
    console.error("📍 Stack trace:", error.stack);
    
    // Nettoyer les fichiers temporaires en cas d'erreur
    if (req.files) {
      console.log("🧹 Nettoyage des fichiers temporaires...");
      Object.keys(req.files).forEach(fieldName => {
        req.files[fieldName].forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Fichier supprimé: ${file.path}`);
          }
        });
      });
    }
    
    return res.status(500).json({
      status: 'error',
      code: 'UPDATE_FAILED',
      message: 'Une erreur est survenue lors de la mise à jour du produit',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur inattendue s\'est produite'
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Vérifier si le produit existe et si l'utilisateur est le propriétaire
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    if (product.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à supprimer ce produit"
      });
    }
    
    // Supprimer d'abord les images du produit
    await prisma.productImage.deleteMany({
      where: { productId: parseInt(id) }
    });
    
    // Supprimer le produit
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });
    
    return res.status(200).json({
      message: "Produit supprimé avec succès"
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du produit:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la suppression du produit",
      error: error.message
    });
  }
};

export const updateProductStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    const userId = req.user.id;
    
    // Vérifier si le produit existe et si l'utilisateur est le propriétaire
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    if (product.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à modifier ce produit"
      });
    }
    
    // S'assurer que le stock est un nombre valide
    if (stock === undefined || stock < 0) {
      return res.status(400).json({
        message: "Veuillez fournir une valeur de stock valide"
      });
    }
    
    // Mettre à jour uniquement le stock du produit
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        stock: parseInt(stock),
        updatedAt: new Date()
      }
    });
    
    return res.status(200).json({
      message: "Stock du produit mis à jour avec succès",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du stock:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du stock",
      error: error.message
    });
  }
};

export const getMerchantProducts = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Vérifier si l'utilisateur existe et est un commerçant
    const merchant = await prisma.user.findUnique({
      where: { id: parseInt(merchantId) }
    });
    
    if (!merchant) {
      return res.status(404).json({ message: "Commerçant non trouvé" });
    }
    
    if (merchant.role !== 'MERCHANT') {
      return res.status(400).json({
        message: "L'utilisateur spécifié n'est pas un commerçant"
      });
    }
    
    // Calculer le nombre d'éléments à sauter
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Récupérer les produits du commerçant
    const products = await prisma.product.findMany({
      where: { userId: parseInt(merchantId) },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        }
      }
    });
    
    // Compter le nombre total de produits pour la pagination
    const totalProducts = await prisma.product.count({
      where: { userId: parseInt(merchantId) }
    });
    
    return res.status(200).json({
      products,
      pagination: {
        total: totalProducts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalProducts / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des produits du commerçant:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des produits",
      error: error.message
    });
  }
};


  
export const searchProducts = async (req, res) => {
  try {
    const { 
      query, 
      category, 
      minPrice,
      maxPrice,
      page = 1, 
      limit = 10 
    } = req.query;
    
    console.log('🔍 Recherche avec paramètres:', { query, category, minPrice, maxPrice, page, limit });
    
    if (!query) {
      return res.status(400).json({
        message: "Veuillez fournir un terme de recherche"
      });
    }
    
    // ✅ CONSTRUIRE LES FILTRES POUR MYSQL (sans mode: "insensitive")
    const filters = {
      status: 'PUBLISHED',
      OR: [
        { name: { contains: query } },        // ✅ SUPPRIMÉ mode: "insensitive"
        { description: { contains: query } }  // ✅ SUPPRIMÉ mode: "insensitive"
      ]
    };
    
    // Ajouter le filtre de catégorie
    if (category) {
      filters.category = category;
    }
    
    // Ajouter les filtres de prix
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) {
        const min = parseFloat(minPrice);
        if (!isNaN(min)) filters.price.gte = min;
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        if (!isNaN(max)) filters.price.lte = max;
      }
    }
    
    console.log('🔧 Filtres appliqués:', JSON.stringify(filters, null, 2));
    
    // Calculer le nombre d'éléments à sauter
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Rechercher les produits
    const products = await prisma.product.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        }
      }
    });
    
    // Compter le nombre total de produits pour la pagination
    const totalProducts = await prisma.product.count({ where: filters });
    
    console.log(`✅ Recherche terminée: ${products.length} produits trouvés sur ${totalProducts} total`);
    
    return res.status(200).json({
      products,
      pagination: {
        total: totalProducts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalProducts / parseInt(limit)),
        hasNextPage: parseInt(page) < Math.ceil(totalProducts / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("❌ Erreur lors de la recherche de produits:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la recherche de produits",
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
export const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Calculer le nombre d'éléments à sauter
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Récupérer les produits de la catégorie
    const products = await prisma.product.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        }
      }
    });
    
    // Compter le nombre total de produits pour la pagination
    const totalProducts = await prisma.product.count({ where: { category } });
    
    return res.status(200).json({
      category,
      products,
      pagination: {
        total: totalProducts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalProducts / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des produits par catégorie:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des produits",
      error: error.message
    });
  }
};

export const getLatestProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        }
      }
    });
    
    return res.status(200).json(products);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits récents:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des produits",
      error: error.message
    });
  }
};

export const getProductCategories = async (req, res) => {
  try {
    // Récupérer toutes les catégories uniques
    const categories = await prisma.product.findMany({
      select: {
        category: true
      },
      distinct: ['category']
    });
    
    // Extraire les noms de catégories
    const categoryNames = categories.map(item => item.category);
    
    return res.status(200).json(categoryNames);
  } catch (error) {
    console.error("Erreur lors de la récupération des catégories:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des catégories",
      error: error.message
    });
  }
};

// Ajouter les fonctions qui sont importées dans productRoutes.js mais non définies dans l'original
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Implémentation simple: prendre les produits avec le plus de stock comme exemple
    const products = await prisma.product.findMany({
      orderBy: { stock: 'desc' },
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        }
      }
    });
    
    return res.status(200).json(products);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits en vedette:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des produits",
      error: error.message
    });
  }
};

export const getProductStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupérer le nombre total de produits du commerçant
    const totalProducts = await prisma.product.count({
      where: { userId }
    });
    
    // Récupérer les produits avec un stock faible (moins de 10 unités)
    const lowStockCount = await prisma.product.count({
      where: { 
        userId,
        stock: { lt: 10 }
      }
    });
    
    // Statistiques par catégorie
    const categoryCounts = await prisma.product.groupBy({
      by: ['category'],
      where: { userId },
      _count: {
        id: true
      }
    });
    
    const categoryStats = categoryCounts.map(item => ({
      category: item.category,
      count: item._count.id
    }));
    
    return res.status(200).json({
      totalProducts,
      lowStockCount,
      categoryStats
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des statistiques",
      error: error.message
    });
  }
};

export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    
    // Récupérer d'abord le produit courant pour obtenir sa catégorie
    const currentProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentProduct) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    // Trouver d'autres produits dans la même catégorie
    const relatedProducts = await prisma.product.findMany({
      where: {
        category: currentProduct.category,
        id: { not: parseInt(id) } // Exclure le produit courant
      },
      take: parseInt(limit),
      include: {
        images: true,
        shop: {
          select: {
            name: true,
            logo: true,
            verifiedBadge: true
          }
        }
      }
    });
    
    return res.status(200).json(relatedProducts);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits associés:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des produits associés",
      error: error.message
    });
  }
};
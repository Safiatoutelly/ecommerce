// Convertir le fichier en utilisant ES Modules
import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';
const prisma = new PrismaClient();

// Exporter chaque fonction individuellement en utilisant des exports nommés

export const createProduct = async (req, res) => {
  try {
    console.log("Données reçues :", req.body);
    console.log("Fichiers reçus :", req.files);

    const { name, description, price, stock, videoUrl, category, status } = req.body;
    const userId = req.user.id; // ID de l'utilisateur connecté

    // Vérifier si l'utilisateur existe et possède une boutique
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shop: true }
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (user.role !== "MERCHANT") {
      return res.status(403).json({ message: "Seuls les commerçants peuvent créer des produits" });
    }

    if (!user.shop) {
      return res.status(403).json({ message: "Vous devez d'abord créer une boutique" });
    }

    // Vérifier si price et stock sont valides
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);

    if (isNaN(parsedPrice) || isNaN(parsedStock)) {
      return res.status(400).json({ message: "Le prix et le stock doivent être des nombres valides" });
    }

    // Déterminer le statut (par défaut DRAFT si non spécifié)
    const productStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

    // Préparer l'URL de la vidéo
    // Si une vidéo est uploadée via Multer, on utilise son chemin
    // Sinon on utilise l'URL fournie dans le formulaire (lien YouTube, etc.)
    let finalVideoUrl = videoUrl;
    if (req.files && req.files.video && req.files.video[0]) {
      // On utilise le chemin relatif pour stocker en BDD
      finalVideoUrl = `/uploads/videos/${req.files.video[0].filename}`;
    }

    // Création du produit
    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parsedPrice,
        stock: parsedStock,
        videoUrl: finalVideoUrl,
        category,
        status: productStatus,
        shopId: user.shop.id,
        userId
      }
    });

    // Ajouter les images uploadées avec Multer
    if (req.files && req.files.productImages && req.files.productImages.length > 0) {
      const productImages = req.files.productImages.map(file => ({
        productId: newProduct.id,
        imageUrl: `/uploads/images/${file.filename}`
      }));

      await prisma.productImage.createMany({
        data: productImages
      });
    }

    // Si le produit est publié, notifier les abonnés
    if (productStatus === 'PUBLISHED') {
      // Trouver tous les abonnés du vendeur
      const subscribers = await prisma.subscription.findMany({
        where: { followingId: userId },
        select: { followerId: true }
      });
      
      // Obtenir les informations du vendeur
      const merchant = {
        firstName: user.firstName,
        lastName: user.lastName
      };
      
      // Créer une notification pour chaque abonné
      if (subscribers.length > 0) {
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
      }
    }

    // Récupérer le produit avec ses images
    const productWithImages = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { images: true }
    });

    return res.status(201).json({
      message: "Produit créé avec succès",
      product: productWithImages
    });
  } catch (error) {
    console.error("Erreur lors de la création du produit :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la création du produit",
      error: error.message
    });
  }
};

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
      return res.status(404).json({ message: "Produit non trouvé ou vous n'avez pas les droits" });
    }

    // Ajouter les images
    if (req.files && req.files.length > 0) {
      const productImages = req.files.map(file => ({
        productId: product.id,
        imageUrl: `/uploads/images/${file.filename}`
      }));

      await prisma.productImage.createMany({
        data: productImages
      });
    } else {
      return res.status(400).json({ message: "Aucune image fournie" });
    }

    // Récupérer le produit mis à jour avec ses images
    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true }
    });

    return res.status(200).json({
      message: "Images ajoutées avec succès",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout des images :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'ajout des images",
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
      return res.status(404).json({ message: "Produit non trouvé ou vous n'avez pas les droits" });
    }

    // Déterminer l'URL de la vidéo (fichier uploadé ou URL externe)
    let finalVideoUrl = videoUrl;
    if (req.file) {
      finalVideoUrl = `/uploads/videos/${req.file.filename}`;
    }

    if (!finalVideoUrl) {
      return res.status(400).json({ message: "Aucune vidéo ou URL de vidéo fournie" });
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
      message: "Vidéo ajoutée avec succès",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout de la vidéo :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'ajout de la vidéo",
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
    const { query, category, page = 1, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        message: "Veuillez fournir un terme de recherche"
      });
    }
    
    // Construire les filtres
    const filters = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    };
    
    // Ajouter le filtre de catégorie si fourni
    if (category) {
      filters.category = category;
    }
    
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
    console.error("Erreur lors de la recherche de produits:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la recherche de produits",
      error: error.message
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
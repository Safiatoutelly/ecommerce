import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';
const prisma = new PrismaClient();

// Aimer/Ne plus aimer un produit
export const toggleLike = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;
    
    // Vérifier si le produit existe et est publié
    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(productId),
        status: 'PUBLISHED' // Seuls les produits publiés peuvent être aimés
      }
    });
    
    if (!product) {
      return res.status(404).json({
        message: "Produit non trouvé ou non publié"
      });
    }
    
    // Vérifier si l'utilisateur a déjà aimé ce produit
    const existingLike = await prisma.productLike.findFirst({
      where: {
        productId: parseInt(productId),
        userId,
        type: 'LIKE'
      }
    });
    
    let message;
    let action;
    
    if (existingLike) {
      // Si l'utilisateur a déjà aimé ce produit, supprimer le like
      await prisma.productLike.delete({
        where: { id: existingLike.id }
      });
      
      // Décrémenter le compteur de likes
      await prisma.product.update({
        where: { id: parseInt(productId) },
        data: {
          likesCount: {
            decrement: 1
          }
        }
      });
      
      message = "Vous n'aimez plus ce produit";
      action = "unliked";
    } else {
      // Vérifier si l'utilisateur a déjà disliké ce produit
      const existingDislike = await prisma.productLike.findFirst({
        where: {
          productId: parseInt(productId),
          userId,
          type: 'DISLIKE'
        }
      });
      
      // Si un dislike existe, le supprimer d'abord
      if (existingDislike) {
        await prisma.productLike.delete({
          where: { id: existingDislike.id }
        });
        
        // Incrémenter le compteur de likes (annuler le dislike)
        await prisma.product.update({
          where: { id: parseInt(productId) },
          data: {
            likesCount: {
              increment: 1
            }
          }
        });
      }
      
      // Créer un nouveau like
      await prisma.productLike.create({
        data: {
          productId: parseInt(productId),
          userId,
          type: 'LIKE'
        }
      });
      
      // Incrémenter le compteur de likes
      await prisma.product.update({
        where: { id: parseInt(productId) },
        data: {
          likesCount: {
            increment: 1
          }
        }
      });
      
      // Récupérer les informations de l'utilisateur qui a aimé
      const likedBy = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true
        }
      });
      
      // Notifier le propriétaire du produit (sauf si c'est lui qui a aimé)
      if (product.userId !== userId) {
        await createNotification({
          userId: product.userId,
          type: 'PRODUCT_LIKE',
          message: `${likedBy.firstName} ${likedBy.lastName} a aimé votre produit "${product.name}"`,
          actionUrl: `/products/${productId}`,
          resourceId: parseInt(productId),
          resourceType: 'Product',
          priority: 1
        });
      }
      
      message = "Vous aimez ce produit";
      action = "liked";
    }
    
    // Récupérer le nombre total de likes pour ce produit
    const likesCount = await prisma.productLike.count({
      where: {
        productId: parseInt(productId),
        type: 'LIKE'
      }
    });
    
    const dislikesCount = await prisma.productLike.count({
      where: {
        productId: parseInt(productId),
        type: 'DISLIKE'
      }
    });
    
    return res.status(200).json({
      message,
      action,
      likesCount,
      dislikesCount
    });
  } catch (error) {
    console.error("Erreur lors de l'interaction avec le like:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'interaction avec le like",
      error: error.message
    });
  }
};

// Ajouter un dislike ou l'annuler
export const toggleDislike = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;
    
    // Vérifier si le produit existe et est publié
    const product = await prisma.product.findUnique({
      where: { 
        id: parseInt(productId),
        status: 'PUBLISHED'
      }
    });
    
    if (!product) {
      return res.status(404).json({ 
        message: "Produit non trouvé ou non publié" 
      });
    }
    
    // Vérifier si l'utilisateur a déjà disliké ce produit
    const existingDislike = await prisma.productLike.findFirst({
      where: {
        productId: parseInt(productId),
        userId,
        type: 'DISLIKE'
      }
    });
    
    let message;
    let action;
    
    if (existingDislike) {
      // Si l'utilisateur a déjà disliké ce produit, supprimer le dislike
      await prisma.productLike.delete({
        where: { id: existingDislike.id }
      });
      
      // Incrémenter le compteur de likes (annuler le dislike)
      await prisma.product.update({
        where: { id: parseInt(productId) },
        data: {
          likesCount: {
            increment: 1
          }
        }
      });
      
      message = "Vous avez annulé votre dislike";
      action = "undisliked";
    } else {
      // Vérifier si l'utilisateur a déjà liké ce produit
      const existingLike = await prisma.productLike.findFirst({
        where: {
          productId: parseInt(productId),
          userId,
          type: 'LIKE'
        }
      });
      
      // Si un like existe, le supprimer d'abord
      if (existingLike) {
        await prisma.productLike.delete({
          where: { id: existingLike.id }
        });
        
        // Décrémenter le compteur de likes
        await prisma.product.update({
          where: { id: parseInt(productId) },
          data: {
            likesCount: {
              decrement: 1
            }
          }
        });
      }
      
      // Créer un nouveau dislike
      await prisma.productLike.create({
        data: {
          productId: parseInt(productId),
          userId,
          type: 'DISLIKE'
        }
      });
      
      // Décrémenter le compteur de likes (pour le dislike)
      await prisma.product.update({
        where: { id: parseInt(productId) },
        data: {
          likesCount: {
            decrement: 1
          }
        }
      });
      
      message = "Vous n'aimez pas ce produit";
      action = "disliked";
    }
    
    // Récupérer le nombre total de likes et dislikes pour ce produit
    const likesCount = await prisma.productLike.count({
      where: { 
        productId: parseInt(productId),
        type: 'LIKE'
      }
    });
    
    const dislikesCount = await prisma.productLike.count({
      where: { 
        productId: parseInt(productId),
        type: 'DISLIKE'
      }
    });
    
    return res.status(200).json({
      message,
      action,
      likesCount,
      dislikesCount
    });
  } catch (error) {
    console.error("Erreur lors de l'interaction avec le dislike:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'interaction avec le dislike",
      error: error.message
    });
  }
};

// Récupérer les utilisateurs qui ont aimé un produit
export const getProductLikes = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, type = 'LIKE' } = req.query;
    
    // Vérifier si le produit existe
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    // Calculer le nombre d'éléments à sauter
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Récupérer les likes/dislikes avec les infos des utilisateurs
    const likes = await prisma.productLike.findMany({
      where: { 
        productId: parseInt(productId),
        type: type.toUpperCase() // LIKE ou DISLIKE
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true
          }
        }
      }
    });
    
    // Compter le nombre total de likes/dislikes pour la pagination
    const totalLikes = await prisma.productLike.count({
      where: { 
        productId: parseInt(productId),
        type: type.toUpperCase()
      }
    });
    
    return res.status(200).json({
      likes,
      pagination: {
        total: totalLikes,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalLikes / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des likes:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des likes",
      error: error.message
    });
  }
};

// Vérifier si un utilisateur a aimé ou disliké un produit
export const getUserReaction = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;
    
    // Vérifier si le produit existe
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    // Rechercher un like ou dislike de l'utilisateur
    const reaction = await prisma.productLike.findFirst({
      where: {
        productId: parseInt(productId),
        userId
      }
    });
    
    if (!reaction) {
      return res.status(200).json({
        hasReaction: false,
        type: null
      });
    }
    
    return res.status(200).json({
      hasReaction: true,
      type: reaction.type // 'LIKE' ou 'DISLIKE'
    });
  } catch (error) {
    console.error("Erreur lors de la vérification de la réaction:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la vérification de la réaction",
      error: error.message
    });
  }
};
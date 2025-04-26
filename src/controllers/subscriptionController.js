import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';  // Importez le service de notification

const prisma = new PrismaClient();

/**
 * Suivre un utilisateur
 * POST /api/users/:userId/follow
 */
export const toggleFollow = async (req, res) => {
    try {
      const { userId } = req.params; // L'ID de l'utilisateur à suivre/ne plus suivre
      const followerId = req.user.id; // L'ID de l'utilisateur authentifié
      
      // Vérifier si l'utilisateur à suivre existe
      const userToFollow = await prisma.user.findUnique({
        where: { id: parseInt(userId) }
      });
      
      if (!userToFollow) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }
      
      // Vérifier que l'utilisateur n'essaie pas de se suivre lui-même
      if (parseInt(userId) === followerId) {
        return res.status(400).json({ message: "Vous ne pouvez pas vous suivre vous-même" });
      }
      
      // Vérifier si l'abonnement existe déjà
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          followerId: followerId,
          followingId: parseInt(userId)
        }
      });
      
      let message;
      let action;
      
      if (existingSubscription) {
        // Si l'abonnement existe, on le supprime (unfollow)
        await prisma.subscription.delete({
          where: { id: existingSubscription.id }
        });
        
        message = "Vous ne suivez plus cet utilisateur";
        action = "unfollowed";
      } else {
        // Sinon, on crée un nouvel abonnement (follow)
        
        // Récupérer les informations de l'utilisateur qui suit
        const follower = await prisma.user.findUnique({
          where: { id: followerId },
          select: {
            firstName: true,
            lastName: true,
            photo: true
          }
        });
        
        // Créer l'abonnement
        await prisma.subscription.create({
          data: {
            followerId: followerId,
            followingId: parseInt(userId)
          }
        });
        
        // Utiliser le service de notification au lieu de créer directement
        await createNotification({
          userId: parseInt(userId),
          type: "FOLLOW",
          message: `${follower.firstName} ${follower.lastName} a commencé à vous suivre. Vous pouvez également le suivre en retour.`,
          actionUrl: `/profil/${followerId}`,
          resourceId: followerId,
          resourceType: "User",
          priority: 2
        });
        
        message = "Vous suivez maintenant cet utilisateur";
        action = "followed";
      }
      
      // Récupérer le nombre d'abonnés mis à jour
      const followerCount = await prisma.subscription.count({
        where: { followingId: parseInt(userId) }
      });
      
      return res.status(200).json({
        message,
        action,
        followerCount,
        userToFollow: {
          id: userToFollow.id,
          firstName: userToFollow.firstName,
          lastName: userToFollow.lastName,
          photo: userToFollow.photo
        }
      });
    } catch (error) {
      console.error("Erreur lors de la gestion de l'abonnement :", error);
      return res.status(500).json({
        message: "Une erreur est survenue lors de la gestion de l'abonnement",
        error: error.message
      });
    }
  };

/**
 * Obtenir la liste des abonnés d'un utilisateur
 * GET /api/users/:userId/followers
 */
export const getUserFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Récupérer les abonnés avec pagination
    const followers = await prisma.subscription.findMany({
      where: { followingId: parseInt(userId) },
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });
    
    // Calculer le nombre total d'abonnés pour la pagination
    const totalFollowers = await prisma.subscription.count({
      where: { followingId: parseInt(userId) }
    });
    
    return res.status(200).json({
      followers: followers.map(f => ({
        id: f.follower.id,
        firstName: f.follower.firstName,
        lastName: f.follower.lastName,
        photo: f.follower.photo,
        role: f.follower.role,
        followedAt: f.createdAt
      })),
      pagination: {
        total: totalFollowers,
        page,
        limit,
        pages: Math.ceil(totalFollowers / limit)
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des abonnés :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des abonnés",
      error: error.message
    });
  }
};

/**
 * Obtenir la liste des abonnements d'un utilisateur
 * GET /api/users/:userId/following
 */
export const getUserFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Récupérer les abonnements avec pagination
    const following = await prisma.subscription.findMany({
      where: { followerId: parseInt(userId) },
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });
    
    // Calculer le nombre total d'abonnements pour la pagination
    const totalFollowing = await prisma.subscription.count({
      where: { followerId: parseInt(userId) }
    });
    
    return res.status(200).json({
      following: following.map(f => ({
        id: f.following.id,
        firstName: f.following.firstName,
        lastName: f.following.lastName,
        photo: f.following.photo,
        role: f.following.role,
        followedAt: f.createdAt
      })),
      pagination: {
        total: totalFollowing,
        page,
        limit,
        pages: Math.ceil(totalFollowing / limit)
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des abonnements :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des abonnements",
      error: error.message
    });
  }
};

/**
 * Vérifier si l'utilisateur authentifié suit un autre utilisateur
 * GET /api/users/:userId/isFollowing
 */
export const checkIfFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;
    
    const subscription = await prisma.subscription.findFirst({
      where: {
        followerId,
        followingId: parseInt(userId)
      }
    });
    
    return res.status(200).json({
      isFollowing: !!subscription
    });
  } catch (error) {
    console.error("Erreur lors de la vérification d'abonnement :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la vérification d'abonnement",
      error: error.message
    });
  }
};

/**
 * Suggérer des utilisateurs à suivre
 * GET /api/users/suggestions
 */
export const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    // Récupérer les IDs des utilisateurs déjà suivis
    const followingIds = await prisma.subscription.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });
    
    const followingIdArray = followingIds.map(f => f.followingId);
    followingIdArray.push(userId); // Ajouter l'ID de l'utilisateur lui-même
    
    // Trouver des utilisateurs aléatoires non suivis (avec un rôle spécifique si nécessaire)
    const suggestedUsers = await prisma.user.findMany({
      where: {
        id: { notIn: followingIdArray }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photo: true,
        role: true,
        // Inclure les statistiques d'abonnés
        _count: {
          select: {
            followers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
    
    return res.status(200).json({
      suggestions: suggestedUsers.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        role: user.role,
        followerCount: user._count.followers
      }))
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des suggestions :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des suggestions",
      error: error.message
    });
  }
};
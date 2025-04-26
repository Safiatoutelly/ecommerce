import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Ajouter un commentaire
export const addComment = async (req, res) => {
  try {
    const { productId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    
  
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
    
   
    const newComment = await prisma.productComment.create({
      data: {
        productId: parseInt(productId),
        userId,
        comment
      }
    });
    
   
    await prisma.product.update({
      where: { id: parseInt(productId) },
      data: {
        commentsCount: {
          increment: 1
        }
      }
    });
    
  
    if (product.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: product.userId,
          type: 'PRODUCT',
          message: `Un utilisateur a commenté votre produit "${product.name}"`,
          actionUrl: `/products/${productId}#comments`,
          resourceId: parseInt(productId),
          resourceType: 'Product'
        }
      });
    }
    
  
    const commentWithUser = await prisma.productComment.findUnique({
      where: { id: newComment.id },
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
    
    return res.status(201).json({
      message: "Commentaire ajouté avec succès",
      comment: commentWithUser
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du commentaire:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'ajout du commentaire",
      error: error.message
    });
  }
};


export const getProductComments = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Vérifier si le produit existe
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    
    // Calculer le nombre d'éléments à sauter
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Récupérer les commentaires
    const comments = await prisma.productComment.findMany({
      where: { productId: parseInt(productId) },
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
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photo: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    // Compter le nombre total de commentaires pour la pagination
    const totalComments = await prisma.productComment.count({
      where: { productId: parseInt(productId) }
    });
    
    return res.status(200).json({
      comments,
      pagination: {
        total: totalComments,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalComments / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des commentaires",
      error: error.message
    });
  }
};

// Répondre à un commentaire
export const replyToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reply } = req.body;
    const userId = req.user.id;
    
    // Vérifier si le commentaire existe
    const comment = await prisma.productComment.findUnique({
      where: { id: parseInt(commentId) },
      include: { product: true }
    });
    
    if (!comment) {
      return res.status(404).json({ message: "Commentaire non trouvé" });
    }
    
    // Créer la réponse
    const newReply = await prisma.commentReply.create({
      data: {
        commentId: parseInt(commentId),
        userId,
        reply
      }
    });
    
    // Notifier l'auteur du commentaire si ce n'est pas la même personne
    if (comment.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: comment.userId,
          type: 'PRODUCT',
          message: `Quelqu'un a répondu à votre commentaire sur un produit`,
          actionUrl: `/products/${comment.productId}#comment-${commentId}`,
          resourceId: comment.productId,
          resourceType: 'Product'
        }
      });
    }
    
    // Récupérer la réponse avec les infos utilisateur
    const replyWithUser = await prisma.commentReply.findUnique({
      where: { id: newReply.id },
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
    
    return res.status(201).json({
      message: "Réponse ajoutée avec succès",
      reply: replyWithUser
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout de la réponse:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'ajout de la réponse",
      error: error.message
    });
  }
};

// Supprimer un commentaire (seulement par l'auteur ou le propriétaire du produit)
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    // Récupérer le commentaire avec le produit associé
    const comment = await prisma.productComment.findUnique({
      where: { id: parseInt(commentId) },
      include: { product: true }
    });
    
    if (!comment) {
      return res.status(404).json({ message: "Commentaire non trouvé" });
    }
    
    // Vérifier si l'utilisateur est autorisé à supprimer ce commentaire
    if (comment.userId !== userId && comment.product.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à supprimer ce commentaire"
      });
    }
    
    // Supprimer d'abord toutes les réponses au commentaire
    await prisma.commentReply.deleteMany({
      where: { commentId: parseInt(commentId) }
    });
    
    // Supprimer le commentaire
    await prisma.productComment.delete({
      where: { id: parseInt(commentId) }
    });
    
    // Décrémenter le compteur de commentaires sur le produit
    await prisma.product.update({
      where: { id: comment.productId },
      data: {
        commentsCount: {
          decrement: 1
        }
      }
    });
    
    return res.status(200).json({
      message: "Commentaire supprimé avec succès"
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du commentaire:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la suppression du commentaire",
      error: error.message
    });
  }
};

// Supprimer une réponse à un commentaire
export const deleteReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = req.user.id;
    
    // Récupérer la réponse avec le commentaire associé
    const reply = await prisma.commentReply.findUnique({
      where: { id: parseInt(replyId) },
      include: { 
        comment: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!reply) {
      return res.status(404).json({ message: "Réponse non trouvée" });
    }
    
    // Vérifier si l'utilisateur est autorisé à supprimer cette réponse
    // (propriétaire de la réponse, du commentaire, ou du produit)
    if (reply.userId !== userId && 
        reply.comment.userId !== userId && 
        reply.comment.product.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à supprimer cette réponse"
      });
    }
    
    // Supprimer la réponse
    await prisma.commentReply.delete({
      where: { id: parseInt(replyId) }
    });
    
    return res.status(200).json({
      message: "Réponse supprimée avec succès"
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de la réponse:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la suppression de la réponse",
      error: error.message
    });
  }
};

// Mettre à jour un commentaire
export const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    
    // Récupérer le commentaire
    const existingComment = await prisma.productComment.findUnique({
      where: { id: parseInt(commentId) }
    });
    
    if (!existingComment) {
      return res.status(404).json({ message: "Commentaire non trouvé" });
    }
    
    // Vérifier si l'utilisateur est l'auteur du commentaire
    if (existingComment.userId !== userId) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à modifier ce commentaire"
      });
    }
    
    // Mettre à jour le commentaire
    const updatedComment = await prisma.productComment.update({
      where: { id: parseInt(commentId) },
      data: {
        comment,
        updatedAt: new Date()
      },
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
    
    return res.status(200).json({
      message: "Commentaire mis à jour avec succès",
      comment: updatedComment
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du commentaire:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du commentaire",
      error: error.message
    });
  }
};
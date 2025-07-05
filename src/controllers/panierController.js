import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ajouter un produit au panier
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;
    
    // Vérifier si le produit existe et est publié
    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(productId),
        status: 'PUBLISHED'
      }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé ou non publié" });
    }
    
    // Vérifier le stock disponible
    if (product.stock < quantity) {
      return res.status(400).json({ message: "Quantité demandée non disponible en stock" });
    }
    
    // Trouver ou créer le panier de l'utilisateur
    let cart = await prisma.cart.findUnique({
      where: { userId }
    });
    
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId }
      });
    }
    
    // Vérifier si le produit est déjà dans le panier
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: parseInt(productId)
        }
      }
    });
    
    if (existingItem) {
      // Mettre à jour la quantité
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { 
          quantity: existingItem.quantity + parseInt(quantity),
          updatedAt: new Date()
        }
      });
    } else {
      // Ajouter un nouvel élément
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: parseInt(productId),
          quantity: parseInt(quantity)
        }
      });
    }
    
    // Récupérer le panier mis à jour avec les produits
    const updatedCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                images: {
                  take: 1 // Prendre juste la première image
                }
              }
            }
          }
        }
      }
    });
    
    return res.status(200).json({
      message: "Produit ajouté au panier",
      cart: updatedCart
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout au panier:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'ajout au panier",
      error: error.message
    });
  }
};

// Obtenir le contenu du panier
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupérer le panier avec les produits
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                images: {
                  take: 1
                }
              }
            }
          }
        }
      }
    });
    
    if (!cart) {
      return res.status(200).json({ 
        message: "Panier vide", 
        cart: { items: [] } 
      });
    }
    
    // Calculer le prix total
    const totalPrice = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
    
    return res.status(200).json({
      cart: {
        ...cart,
        totalPrice
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du panier:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération du panier",
      error: error.message
    });
  }
};

// Mettre à jour la quantité d'un article dans le panier
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    // Vérifier si le panier existe
    const cart = await prisma.cart.findUnique({
      where: { userId }
    });
    
    if (!cart) {
      return res.status(404).json({ message: "Panier non trouvé" });
    }
    
    // Vérifier si l'élément existe et appartient au panier de l'utilisateur
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(itemId),
        cartId: cart.id
      },
      include: {
        product: true
      }
    });
    
    if (!cartItem) {
      return res.status(404).json({ message: "Article non trouvé dans le panier" });
    }
    
    // Vérifier le stock disponible
    if (quantity > cartItem.product.stock) {
      return res.status(400).json({ message: "Quantité demandée non disponible en stock" });
    }
    
    if (quantity <= 0) {
      // Supprimer l'article si la quantité est 0 ou négative
      await prisma.cartItem.delete({
        where: { id: parseInt(itemId) }
      });
      
      return res.status(200).json({
        message: "Article retiré du panier"
      });
    } else {
      // Mettre à jour la quantité
      await prisma.cartItem.update({
        where: { id: parseInt(itemId) },
        data: { 
          quantity: parseInt(quantity),
          updatedAt: new Date()
        }
      });
    }
    
    // Récupérer le panier mis à jour
    const updatedCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                images: {
                  take: 1
                }
              }
            }
          }
        }
      }
    });
    
    // Calculer le prix total
    const totalPrice = updatedCart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
    
    return res.status(200).json({
      message: "Panier mis à jour",
      cart: {
        ...updatedCart,
        totalPrice
      }
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du panier:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du panier",
      error: error.message
    });
  }
};

// Supprimer un article du panier
export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    
    // Vérifier si le panier existe
    const cart = await prisma.cart.findUnique({
      where: { userId }
    });
    
    if (!cart) {
      return res.status(404).json({ message: "Panier non trouvé" });
    }
    
    // Vérifier si l'élément existe et appartient au panier de l'utilisateur
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(itemId),
        cartId: cart.id
      }
    });
    
    if (!cartItem) {
      return res.status(404).json({ message: "Article non trouvé dans le panier" });
    }
    
    // Supprimer l'article
    await prisma.cartItem.delete({
      where: { id: parseInt(itemId) }
    });
    
    return res.status(200).json({
      message: "Article retiré du panier"
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'article:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la suppression de l'article",
      error: error.message
    });
  }
};

// Vider le panier
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Vérifier si le panier existe
    const cart = await prisma.cart.findUnique({
      where: { userId }
    });
    
    if (!cart) {
      return res.status(404).json({ message: "Panier non trouvé" });
    }
    
    // Supprimer tous les articles du panier
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });
    
    return res.status(200).json({
      message: "Panier vidé avec succès"
    });
  } catch (error) {
    console.error("Erreur lors du vidage du panier:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors du vidage du panier",
      error: error.message
    });
  }
};

// Partager le panier via WhatsApp
export const shareCartViaMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;
    
    console.log("Début de l'envoi de messages pour le panier de l'utilisateur:", userId);
    
    // Récupérer le panier avec les produits et leurs images
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: {
                  select: {
                    imageUrl: true
                  },
                  take: 1
                },
                shop: {
                  select: {
                    id: true,
                    name: true,
                    userId: true, // ID du marchand
                    logo: true
                  }
                }
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true
          }
        }
      }
    });
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Panier vide" });
    }
    
    // Regrouper les articles par boutique
    const shopItems = {};
    
    cart.items.forEach(item => {
      const merchantId = item.product.shop.userId;
      
      if (!shopItems[merchantId]) {
        shopItems[merchantId] = {
          merchantId: merchantId,
          shopId: item.product.shop.id,
          shopName: item.product.shop.name,
          logo: item.product.shop.logo,
          items: []
        };
      }
      
      shopItems[merchantId].items.push({
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity,
        imageUrl: item.product.images?.[0]?.imageUrl
      });
    });
    
    console.log("Articles regroupés par boutique:", Object.keys(shopItems).length, "boutiques");
    
    // Envoyer un message à chaque marchand
    const messageResults = [];
    
    for (const merchantId in shopItems) {
      const shop = shopItems[merchantId];
      const shopTotal = shop.items.reduce((sum, item) => sum + item.total, 0);
      
      // Construire le message pour le marchand
      let messageContent = `🛒 **Demande de panier** de ${cart.user.firstName} ${cart.user.lastName}\n\n`;
      messageContent += `Bonjour ! Je souhaite commander les articles suivants de votre boutique "${shop.shopName}" :\n\n`;
      
      // Ajouter chaque article
      shop.items.forEach((item, index) => {
        messageContent += `${index + 1}. **${item.name}**\n`;
        messageContent += `   - Quantité: ${item.quantity}\n`;
        messageContent += `   - Prix unitaire: ${item.price.toLocaleString()} FCFA\n`;
        messageContent += `   - Total: ${item.total.toLocaleString()} FCFA\n\n`;
      });
      
      messageContent += `**TOTAL: ${shopTotal.toLocaleString()} FCFA**\n\n`;
      
      // Ajouter le message personnalisé si fourni
      if (message) {
        messageContent += `Message: ${message}\n\n`;
      }
      
      // Ajouter les coordonnées
      messageContent += `Mes coordonnées:\n`;
      messageContent += `📱 Téléphone: ${cart.user.phoneNumber}\n`;
      if (cart.user.email) {
        messageContent += `📧 Email: ${cart.user.email}\n`;
      }
      messageContent += `\nMerci de me confirmer la disponibilité et les modalités !`;
      
      try {
        // Créer le message dans la base de données
        const sentMessage = await prisma.message.create({
          data: {
            senderId: userId,
            receiverId: parseInt(merchantId),
            content: messageContent,
            isRead: false
          },
          include: {
            receiver: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        });
        
        // Créer une notification pour le marchand
        await createNotification({
          userId: parseInt(merchantId),
          type: "MESSAGE",
          message: `Nouvelle demande de panier de ${cart.user.firstName} ${cart.user.lastName}`,
          resourceId: sentMessage.id,
          resourceType: "Message",
          actionUrl: `/messages/${userId}`,
          priority: 2
        });
        
        // Émettre un événement Socket.IO si disponible
        if (global.io) {
          global.io.to(`user_${merchantId}`).emit('new_message', {
            message: sentMessage,
            sender: {
              id: userId,
              name: `${cart.user.firstName} ${cart.user.lastName}`,
              photo: req.user.photo
            }
          });
        }
        
        messageResults.push({
          merchantId: parseInt(merchantId),
          shopName: shop.shopName,
          messageId: sentMessage.id,
          success: true
        });
        
      } catch (error) {
        console.error(`Erreur envoi message au marchand ${merchantId}:`, error);
        messageResults.push({
          merchantId: parseInt(merchantId),
          shopName: shop.shopName,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log("Messages envoyés:", messageResults.length);
    
    return res.status(200).json({
      message: "Messages envoyés aux marchands avec succès",
      results: messageResults,
      totalMerchants: Object.keys(shopItems).length
    });
    
  } catch (error) {
    console.error("Erreur lors de l'envoi des messages:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'envoi des messages",
      error: error.message
    });
  }
};

export const createOrderFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;
    
    // Récupérer le panier avec les produits
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                images: {
                  select: {
                    imageUrl: true
                  },
                  take: 1
                },
                shop: {
                  select: {
                    id: true,
                    name: true,
                    userId: true, // ID du marchand
                    logo: true
                  }
                }
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true
          }
        }
      }
    });
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Panier vide" });
    }
    
    // Vérifier le stock disponible
    for (const item of cart.items) {
      if (item.quantity > item.product.stock) {
        return res.status(400).json({ 
          message: `Stock insuffisant pour ${item.product.name}`,
          productId: item.product.id
        });
      }
    }
    
    // Créer la commande
    const order = await prisma.order.create({
      data: {
        clientId: userId,
        totalAmount: cart.items.reduce((total, item) => {
          return total + (item.product.price * item.quantity);
        }, 0),
        status: 'PENDING',
        paymentMethod: 'CASH_ON_DELIVERY',
        orderItems: {
          create: cart.items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price
          }))
        }
      },
      include: {
        orderItems: true
      }
    });
    
    // Regrouper par boutique
    const shopItems = {};
    
    cart.items.forEach(item => {
      const merchantId = item.product.shop.userId;
      
      if (!shopItems[merchantId]) {
        shopItems[merchantId] = {
          merchantId: merchantId,
          shopId: item.product.shop.id,
          shopName: item.product.shop.name,
          logo: item.product.shop.logo,
          items: []
        };
      }
      
      shopItems[merchantId].items.push({
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity,
        imageUrl: item.product.images?.[0]?.imageUrl
      });
    });
    
    // Envoyer des messages aux marchands pour la commande
    const messageResults = [];
    
    for (const merchantId in shopItems) {
      const shop = shopItems[merchantId];
      const shopTotal = shop.items.reduce((sum, item) => sum + item.total, 0);
      
      // Message pour la commande
      let messageContent = `🎉 **NOUVELLE COMMANDE #${order.id}**\n\n`;
      messageContent += `Bonjour ! J'ai passé la commande #${order.id} sur Bibocom Market.\n\n`;
      messageContent += `**Articles commandés de "${shop.shopName}" :**\n\n`;
      
      shop.items.forEach((item, index) => {
        messageContent += `${index + 1}. **${item.name}**\n`;
        messageContent += `   - Quantité: ${item.quantity}\n`;
        messageContent += `   - Prix: ${item.price.toLocaleString()} FCFA\n`;
        messageContent += `   - Total: ${item.total.toLocaleString()} FCFA\n\n`;
      });
      
      messageContent += `**TOTAL: ${shopTotal.toLocaleString()} FCFA**\n\n`;
      
      if (message) {
        messageContent += `Message: ${message}\n\n`;
      }
      
      messageContent += `**Mes coordonnées:**\n`;
      messageContent += `📱 ${cart.user.phoneNumber}\n`;
      if (cart.user.email) {
        messageContent += `📧 ${cart.user.email}\n`;
      }
      
      messageContent += `\n**Référence:** #${order.id}\n`;
      messageContent += `**Date:** ${new Date().toLocaleDateString('fr-FR')}\n\n`;
      messageContent += `Merci de confirmer la commande et m'indiquer les modalités de livraison !`;
      
      try {
        // Créer le message
        const sentMessage = await prisma.message.create({
          data: {
            senderId: userId,
            receiverId: parseInt(merchantId),
            content: messageContent,
            isRead: false
          }
        });
        
        // Notification pour le marchand
        await createNotification({
          userId: parseInt(merchantId),
          type: "ORDER",
          message: `Nouvelle commande #${order.id} de ${cart.user.firstName} ${cart.user.lastName}`,
          resourceId: order.id,
          resourceType: "Order",
          actionUrl: `/messages/${userId}`,
          priority: 1
        });
        
        // Socket.IO
        if (global.io) {
          global.io.to(`user_${merchantId}`).emit('new_message', {
            message: sentMessage,
            sender: {
              id: userId,
              name: `${cart.user.firstName} ${cart.user.lastName}`,
              photo: req.user.photo
            }
          });
        }
        
        messageResults.push({
          merchantId: parseInt(merchantId),
          shopName: shop.shopName,
          messageId: sentMessage.id,
          success: true
        });
        
      } catch (error) {
        console.error(`Erreur message marchand ${merchantId}:`, error);
        messageResults.push({
          merchantId: parseInt(merchantId),
          shopName: shop.shopName,
          success: false,
          error: error.message
        });
      }
    }
    
    // Vider le panier
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });
    
    return res.status(200).json({
      message: "Commande créée et messages envoyés aux marchands",
      order: {
        id: order.id,
        totalAmount: order.totalAmount,
        status: 'PENDING',
        createdAt: order.createdAt
      },
      messageResults
    });
    
  } catch (error) {
    console.error("Erreur création commande:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la création de la commande",
      error: error.message
    });
  }
};
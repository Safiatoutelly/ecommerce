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
export const shareCartViaWhatsApp = async (req, res) => {
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
                shop: {
                  select: {
                    phoneNumber: true,
                    name: true
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
            phoneNumber: true
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
      const shopId = item.product.shop.phoneNumber;
      
      if (!shopItems[shopId]) {
        shopItems[shopId] = {
          shopName: item.product.shop.name,
          phoneNumber: shopId,
          items: []
        };
      }
      
      shopItems[shopId].items.push({
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity
      });
    });
    
    // Créer le message pour chaque boutique
    const whatsappLinks = [];
    
    for (const shopId in shopItems) {
      const shop = shopItems[shopId];
      
      // Calculer le total pour cette boutique
      const shopTotal = shop.items.reduce((sum, item) => sum + item.total, 0);
      
      // Construire le message
      let whatsappMessage = `Bonjour, je suis ${cart.user.firstName} ${cart.user.lastName}.\n\n`;
      whatsappMessage += `Je souhaite commander les articles suivants de votre boutique "${shop.shopName}" :\n\n`;
      
      shop.items.forEach((item, index) => {
        whatsappMessage += `${index + 1}. ${item.name} - ${item.quantity} x ${item.price} F CFA = ${item.total} F CFA\n`;
      });
      
      whatsappMessage += `\nTotal : ${shopTotal} F CFA\n\n`;
      
      if (message) {
        whatsappMessage += `Message additionnel : ${message}\n\n`;
      }
      
      whatsappMessage += `Mon numéro de téléphone : ${cart.user.phoneNumber}\n`;
      whatsappMessage += `Veuillez me contacter pour finaliser la commande. Merci !`;
      
      // Encoder le message pour l'URL WhatsApp
      const encodedMessage = encodeURIComponent(whatsappMessage);
      const whatsappLink = `https://wa.me/${shop.phoneNumber.replace(/\+/g, '')}?text=${encodedMessage}`;
      
      whatsappLinks.push({
        shopName: shop.shopName,
        link: whatsappLink
      });
    }
    
    return res.status(200).json({
      message: "Liens WhatsApp générés avec succès",
      whatsappLinks
    });
  } catch (error) {
    console.error("Erreur lors de la génération des liens WhatsApp:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la génération des liens WhatsApp",
      error: error.message
    });
  }
};
// Créer une commande à partir du panier et générer des liens WhatsApp
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
                shop: {
                  select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    userId: true
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
    
    // Vérifier le stock disponible pour tous les produits
    for (const item of cart.items) {
      if (item.quantity > item.product.stock) {
        return res.status(400).json({ 
          message: `Stock insuffisant pour ${item.product.name}`,
          productId: item.product.id
        });
      }
    }
    
    // Créer une commande
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
    
    // Regrouper les articles par boutique pour les notifications et messages WhatsApp
    const shopItems = {};
    
    cart.items.forEach(item => {
      const shopId = item.product.shop.userId;
      const phoneNumber = item.product.shop.phoneNumber;
      
      if (!shopItems[shopId]) {
        shopItems[shopId] = {
          shopId: item.product.shop.id,
          merchantId: shopId,
          shopName: item.product.shop.name,
          phoneNumber: phoneNumber,
          items: []
        };
      }
      
      shopItems[shopId].items.push({
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity
      });
    });
    
    // Créer des notifications pour les commerçants
    const notificationPromises = [];
    
    for (const shopId in shopItems) {
      notificationPromises.push(
        prisma.notification.create({
          data: {
            userId: parseInt(shopId),
            type: 'ORDER',
            message: `Nouvelle commande #${order.id} de ${cart.user.firstName} ${cart.user.lastName}`,
            actionUrl: `/dashboard/orders/${order.id}`,
            resourceId: order.id,
            resourceType: 'Order',
            priority: 1
          }
        })
      );
    }
    
    await Promise.all(notificationPromises);
    
    // Créer les liens WhatsApp pour chaque boutique
    const whatsappLinks = [];
    
    for (const shopId in shopItems) {
      const shop = shopItems[shopId];
      
      // Calculer le total pour cette boutique
      const shopTotal = shop.items.reduce((sum, item) => sum + item.total, 0);
      
      // Construire le message WhatsApp
      let whatsappMessage = `Bonjour, je suis ${cart.user.firstName} ${cart.user.lastName}.\n\n`;
      whatsappMessage += `J'ai passé la commande #${order.id} sur Bibocom_Market et je souhaite confirmer les articles suivants de votre boutique "${shop.shopName}" :\n\n`;
      
      shop.items.forEach((item, index) => {
        whatsappMessage += `${index + 1}. ${item.name} - ${item.quantity} x ${item.price} F CFA = ${item.total} F CFA\n`;
      });
      
      whatsappMessage += `\nTotal : ${shopTotal} F CFA\n\n`;
      
      if (message) {
        whatsappMessage += `Message additionnel : ${message}\n\n`;
      }
      
      whatsappMessage += `Mon numéro de téléphone : ${cart.user.phoneNumber}\n`;
      if (cart.user.email) {
        whatsappMessage += `Mon email : ${cart.user.email}\n`;
      }
      whatsappMessage += `Veuillez me contacter pour finaliser la commande. Merci !`;
      
      // Encoder le message pour l'URL WhatsApp
      const encodedMessage = encodeURIComponent(whatsappMessage);
      const whatsappLink = `https://wa.me/${shop.phoneNumber.replace(/\+/g, '')}?text=${encodedMessage}`;
      
      whatsappLinks.push({
        shopName: shop.shopName,
        link: whatsappLink
      });
    }
    
    // Vider le panier après création de la commande
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });
    
    return res.status(200).json({
      message: "Commande créée avec succès",
      order: {
        id: order.id,
        totalAmount: order.totalAmount,
        status: 'PENDING',
        createdAt: order.createdAt
      },
      whatsappLinks
    });
  } catch (error) {
    console.error("Erreur lors de la création de la commande:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la création de la commande",
      error: error.message
    });
  }
};
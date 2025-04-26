import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Récupérer toutes les commandes d'un client
export const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const orders = await prisma.order.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
                images: { take: 1 },
                shop: {
                  select: {
                    id: true,
                    name: true,
                    phoneNumber: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    return res.status(200).json({ orders });
  } catch (error) {
    console.error("Erreur lors de la récupération des commandes:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des commandes",
      error: error.message
    });
  }
};

// Récupérer une commande spécifique
export const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    
    const order = await prisma.order.findFirst({
      where: { 
        id: parseInt(orderId),
        clientId: userId 
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: { take: 1 },
                shop: {
                  select: {
                    id: true,
                    name: true,
                    phoneNumber: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ message: "Commande non trouvée" });
    }
    
    return res.status(200).json({ order });
  } catch (error) {
    console.error("Erreur lors de la récupération de la commande:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération de la commande",
      error: error.message
    });
  }
};

// Mettre à jour le statut d'une commande (pour les marchands)
export const updateOrderStatus = async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Vérifier si le statut est valide
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Statut de commande invalide" });
    }
    
    // Vérifier si la commande existe et contient des produits du marchand
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                shopId: true,
                shop: {
                  select: { userId: true }
                }
              }
            }
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ message: "Commande non trouvée" });
    }
    
    // Vérifier si le marchand est autorisé à modifier cette commande
    const isMerchantOrder = order.orderItems.some(item => 
      item.product.shop.userId === merchantId
    );
    
    if (!isMerchantOrder) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier cette commande" });
    }
    
    // Mettre à jour le statut de la commande
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { status },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    // Créer une notification pour le client
    await prisma.notification.create({
      data: {
        userId: order.client.id,
        type: 'ORDER',
        message: `Votre commande #${orderId} est maintenant ${status === 'CONFIRMED' ? 'confirmée' : 
                   status === 'SHIPPED' ? 'en cours de livraison' : 
                   status === 'DELIVERED' ? 'livrée' : 
                   status === 'CANCELED' ? 'annulée' : 
                   'mise à jour'}`,
        actionUrl: `/orders/${orderId}`,
        resourceId: parseInt(orderId),
        resourceType: 'Order'
      }
    });
    
    return res.status(200).json({
      message: "Statut de la commande mis à jour",
      order: updatedOrder
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut de la commande:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du statut de la commande",
      error: error.message
    });
  }
};

// Récupérer les commandes pour un marchand
export const getMerchantOrders = async (req, res) => {
  try {
    const merchantId = req.user.id;
    
    // Vérifier si l'utilisateur est un marchand
    const merchant = await prisma.user.findUnique({
      where: { id: merchantId },
      include: { shop: true }
    });
    
    if (!merchant || !merchant.shop) {
      return res.status(403).json({ message: "Accès refusé. Vous n'êtes pas un marchand." });
    }
    
    // Trouver toutes les commandes contenant des produits de ce marchand
    const shopId = merchant.shop.id;
    
    const orderItems = await prisma.orderItem.findMany({
      where: {
        product: {
          shopId: shopId
        }
      },
      include: {
        order: {
          include: {
            client: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
                email: true
              }
            }
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: { take: 1 }
          }
        }
      },
      orderBy: {
        order: {
          createdAt: 'desc'
        }
      }
    });
    
    // Restructurer les données pour regrouper les articles par commande
    const orders = {};
    orderItems.forEach(item => {
      const orderId = item.order.id;
      
      if (!orders[orderId]) {
        orders[orderId] = {
          id: orderId,
          status: item.order.status,
          client: item.order.client,
          createdAt: item.order.createdAt,
          totalAmount: 0,
          items: []
        };
      }
      
      orders[orderId].items.push({
        id: item.id,
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity
      });
      
      orders[orderId].totalAmount += item.price * item.quantity;
    });
    
    return res.status(200).json({
      orders: Object.values(orders)
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des commandes du marchand:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des commandes",
      error: error.message
    });
  }
};
// Dans orderController.js
// Dans orderController.js
export const checkOrderConfirmation = async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      
      const order = await prisma.order.findFirst({
        where: { 
          id: parseInt(orderId),
          clientId: userId 
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                  shop: {
                    select: {
                      id: true,
                      name: true,
                      phoneNumber: true
                    }
                  }
                }
              }
            }
          },
          client: {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true
            }
          }
        }
      });
      
      if (!order) {
        return res.status(404).json({ message: "Commande non trouvée" });
      }
      
      // Si la commande est toujours en attente, proposer de recontacter
      if (order.status === 'PENDING') {
        // Regrouper par boutique comme dans createOrderFromCart
        const shopItems = {};
        
        order.orderItems.forEach(item => {
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
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          });
        });
        
        // Créer les liens WhatsApp
        const whatsappLinks = [];
        
        for (const shopId in shopItems) {
          const shop = shopItems[shopId];
          
          // Calculer le total pour cette boutique
          const shopTotal = shop.items.reduce((sum, item) => sum + item.total, 0);
          
          // Construire le message
          let whatsappMessage = `Bonjour, je suis ${order.client.firstName} ${order.client.lastName}.\n\n`;
          whatsappMessage += `Je vous recontacte concernant ma commande #${order.id} passée sur Bibocom_Market.\n\n`;
          whatsappMessage += `J'aimerais savoir si vous avez bien reçu ma commande pour les articles suivants :\n\n`;
          
          shop.items.forEach((item, index) => {
            whatsappMessage += `${index + 1}. ${item.name} - ${item.quantity} x ${item.price} F CFA = ${item.total} F CFA\n`;
          });
          
          whatsappMessage += `\nTotal : ${shopTotal} F CFA\n\n`;
          whatsappMessage += `Mon numéro de téléphone : ${order.client.phoneNumber}\n`;
          whatsappMessage += `Merci de me confirmer la disponibilité de ces articles.`;
          
          // Encoder le message pour l'URL WhatsApp
          const encodedMessage = encodeURIComponent(whatsappMessage);
          const whatsappLink = `https://wa.me/${shop.phoneNumber.replace(/\+/g, '')}?text=${encodedMessage}`;
          
          whatsappLinks.push({
            shopName: shop.shopName,
            link: whatsappLink
          });
        }
        
        return res.status(200).json({
          message: "Votre commande est toujours en attente de confirmation",
          orderId: order.id,
          status: order.status,
          whatsappLinks: whatsappLinks  // La valeur était manquante ici
        });
      } else {
        return res.status(200).json({
          message: `Votre commande est ${
            order.status === 'CONFIRMED' ? 'confirmée' : 
            order.status === 'SHIPPED' ? 'en cours de livraison' : 
            order.status === 'DELIVERED' ? 'livrée' : 
            order.status === 'CANCELED' ? 'annulée' :
            'dans un autre état'
          }`,
          orderId: order.id,
          status: order.status
        });
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la commande:", error);
      return res.status(500).json({
        message: "Une erreur est survenue lors de la vérification de la commande",
        error: error.message
      });
    }
  };
  
  // Fonction pour demander un feedback sur le commerçant
  export const requestMerchantFeedback = async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      
      // Vérifier si la commande existe et appartient à l'utilisateur
      const order = await prisma.order.findFirst({
        where: { 
          id: parseInt(orderId),
          clientId: userId,
          status: 'CONFIRMED' // On ne demande feedback que pour les commandes confirmées
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  shop: {
                    select: {
                      id: true,
                      name: true,
                      userId: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!order) {
        return res.status(404).json({ message: "Commande confirmée non trouvée" });
      }
      
      // Obtenir les commerçants uniques pour cette commande
      const merchants = [];
      const merchantIds = new Set();
      
      order.orderItems.forEach(item => {
        const merchantId = item.product.shop.userId;
        const shopId = item.product.shop.id;
        const shopName = item.product.shop.name;
        
        if (!merchantIds.has(merchantId)) {
          merchantIds.add(merchantId);
          merchants.push({
            merchantId,
            shopId,
            shopName
          });
        }
      });
      
      return res.status(200).json({
        message: "Veuillez évaluer vos interactions avec ces commerçants",
        orderId: order.id,
        merchants
      });
    } catch (error) {
      console.error("Erreur lors de la demande de feedback:", error);
      return res.status(500).json({
        message: "Une erreur est survenue lors de la demande de feedback",
        error: error.message
      });
    }
  };
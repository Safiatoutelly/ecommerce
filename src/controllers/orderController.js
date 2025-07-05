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


export const updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role; // 🆕 Récupérer le rôle utilisateur
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Vérifier si le statut est valide
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Statut de commande invalide" });
    }
    
    // Vérifier si la commande existe
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                shopId: true,
                shop: {
                  select: { 
                    userId: true,
                    name: true
                  }
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
    
    // 🆕 LOGIQUE D'AUTORISATION AMÉLIORÉE
    let isAuthorized = false;
    let actorType = '';
    
    if (userRole === 'CLIENT') {
      // Les clients peuvent annuler leurs propres commandes (seulement PENDING)
      if (order.clientId === userId && status === 'CANCELED' && order.status === 'PENDING') {
        isAuthorized = true;
        actorType = 'CLIENT';
      }
      // Les clients peuvent confirmer la réception (SHIPPED → DELIVERED)
      else if (order.clientId === userId && status === 'DELIVERED' && order.status === 'SHIPPED') {
        isAuthorized = true;
        actorType = 'CLIENT';
      }
    } 
    else if (userRole === 'MERCHANT') {
      // Les marchands peuvent modifier leurs commandes
      const isMerchantOrder = order.orderItems.some(item => 
        item.product.shop.userId === userId
      );
      if (isMerchantOrder) {
        isAuthorized = true;
        actorType = 'MERCHANT';
      }
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ 
        message: "Vous n'êtes pas autorisé à effectuer cette action sur cette commande",
        details: {
          userRole,
          requestedStatus: status,
          currentStatus: order.status,
          clientId: order.clientId,
          userId
        }
      });
    }
    
    // Mettre à jour le statut de la commande
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { status },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                shop: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        }
      }
    });
    
    // 🆕 Messages personnalisés selon l'acteur ET le statut
    if (actorType === 'CLIENT' && status === 'CANCELED') {
      // Client annule sa commande
      await prisma.notification.create({
        data: {
          userId: order.client.id,
          type: 'ORDER',
          message: `❌ Vous avez annulé votre commande #COMANDE-${orderId}. Nous espérons vous revoir bientôt !`,
          actionUrl: `/commandes/${orderId}`,
          resourceId: parseInt(orderId),
          resourceType: 'Order',
          priority: 1
        }
      });
      
      // Notifier les marchands de l'annulation
      const merchantIds = [...new Set(order.orderItems.map(item => item.product.shop.userId))];
      for (const merchantId of merchantIds) {
        await prisma.notification.create({
          data: {
            userId: merchantId,
            type: 'ORDER',
            message: `❌ Le client ${order.client.firstName} ${order.client.lastName} a annulé la commande #COMANDE-${orderId}.`,
            actionUrl: `/commandes-recues`,
            resourceId: parseInt(orderId),
            resourceType: 'Order',
            priority: 1
          }
        });
      }
    }
    else if (actorType === 'CLIENT' && status === 'DELIVERED') {
      // Client confirme la réception
      await prisma.notification.create({
        data: {
          userId: order.client.id,
          type: 'ORDER',
          message: `✅ Merci ${order.client.firstName} ! Vous avez confirmé la réception de votre commande #COMANDE-${orderId}. N'hésitez pas à laisser un avis !`,
          actionUrl: `/commandes/${orderId}`,
          resourceId: parseInt(orderId),
          resourceType: 'Order',
          priority: 1
        }
      });
      
      // Notifier les marchands de la livraison confirmée
      const merchantIds = [...new Set(order.orderItems.map(item => item.product.shop.userId))];
      for (const merchantId of merchantIds) {
        await prisma.notification.create({
          data: {
            userId: merchantId,
            type: 'ORDER',
            message: `🎉 Excellent ! ${order.client.firstName} ${order.client.lastName} a confirmé avoir reçu la commande #COMANDE-${orderId}.`,
            actionUrl: `/commandes-recues`,
            resourceId: parseInt(orderId),
            resourceType: 'Order',
            priority: 1
          }
        });
      }
    }
    else {
      // Messages existants pour les marchands (votre code actuel)
      const statusMessages = {
        'CONFIRMED': {
          client: `🎉 Félicitations ${order.client.firstName} ! Le commerçant vient de confirmer votre commande #COMANDE-${orderId}. Préparez-vous à recevoir vos articles bientôt !`,
          merchant: `✅ Parfait ! Vous avez confirmé la commande #COMANDE-${orderId} de ${order.client.firstName} ${order.client.lastName}.`
        },
        'SHIPPED': {
          client: `🚚 Excellente nouvelle ${order.client.firstName} ! Votre commande #COMANDE-${orderId} est maintenant en route vers vous !`,
          merchant: `📦 Commande #COMANDE-${orderId} marquée comme expédiée avec succès !`
        },
        'CANCELED': {
          client: `❌ Votre commande #COMANDE-${orderId} a été annulée par le commerçant.`,
          merchant: `❌ Vous avez annulé la commande #COMANDE-${orderId}.`
        }
      };
      
      if (statusMessages[status]) {
        await prisma.notification.create({
          data: {
            userId: order.client.id,
            type: 'ORDER',
            message: statusMessages[status].client,
            actionUrl: `/commandes/${orderId}`,
            resourceId: parseInt(orderId),
            resourceType: 'Order',
            priority: 1
          }
        });
        
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'ORDER',
            message: statusMessages[status].merchant,
            actionUrl: `/commandes-recues`,
            resourceId: parseInt(orderId),
            resourceType: 'Order',
            priority: 1
          }
        });
      }
    }
    
    console.log(`✅ Commande #${orderId} mise à jour: ${status} par ${actorType} ${userId}`);
    
    return res.status(200).json({
      message: "Statut de la commande mis à jour avec succès",
      order: updatedOrder,
      notifications: "Notifications envoyées",
      actor: actorType
    });
    
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut de la commande:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour du statut de la commande",
      error: error.message
    });
  }
};

// 🔧 SOLUTION 2: Alternative - Créer une route dédiée pour l'annulation client
export const cancelOrderByClient = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { orderId } = req.params;
    
    // Vérifier si la commande existe et appartient au client
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
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
    
    if (order.clientId !== clientId) {
      return res.status(403).json({ message: "Cette commande ne vous appartient pas" });
    }
    
    if (order.status !== 'PENDING') {
      return res.status(400).json({ 
        message: "Vous ne pouvez annuler que les commandes en attente",
        currentStatus: order.status
      });
    }
    
    // Annuler la commande
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { status: 'CANCELED' },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                shop: {
                  select: {
                    name: true,
                    userId: true
                  }
                }
              }
            }
          }
        },
        client: true
      }
    });
    
    // Créer notifications...
    // (même logique que ci-dessus)
    
    return res.status(200).json({
      message: "Commande annulée avec succès",
      order: updatedOrder
    });
    
  } catch (error) {
    console.error("Erreur lors de l'annulation:", error);
    return res.status(500).json({
      message: "Erreur lors de l'annulation de la commande",
      error: error.message
    });
  }
};

// 📝 RÈGLES BUSINESS RECOMMANDÉES:
// ✅ CLIENT peut annuler: PENDING → CANCELED
// ✅ CLIENT peut confirmer réception: SHIPPED → DELIVERED  
// ✅ MERCHANT peut: PENDING → CONFIRMED → SHIPPED
// ✅ MERCHANT peut annuler: PENDING/CONFIRMED → CANCELED
// ❌ Personne ne peut modifier: DELIVERED, CANCELED (statuts finaux)

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
                    userId: true,
                    owner: {  // ✅ CHANGÉ de 'user' à 'owner'
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photo: true,
                        // Attention: isOnline n'existe pas dans votre schéma !
                        // isOnline: true  ← COMMENTÉ
                      }
                    }
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
    
    // Si la commande est toujours en attente
    if (order.status === 'PENDING') {
      // Obtenir la liste des marchands uniques
      const merchants = [];
      const merchantIds = new Set();
      
      order.orderItems.forEach(item => {
        const merchantId = item.product.shop.userId;
        const shopName = item.product.shop.name;
        const merchantInfo = item.product.shop.owner; // ✅ Utilise 'owner'
        
        if (!merchantIds.has(merchantId)) {
          merchantIds.add(merchantId);
          merchants.push({
            merchantId,
            shopName,
            merchantFirstName: merchantInfo.firstName,   // ✅ Disponible
            merchantLastName: merchantInfo.lastName,     // ✅ Disponible
            merchantPhoto: merchantInfo.photo,           // ✅ Disponible
            isOnline: false  // ✅ Valeur par défaut car pas dans le schéma
          });
        }
      });
      
      return res.status(200).json({
        message: "Votre commande est toujours en attente de confirmation",
        orderId: order.id,
        status: order.status,
        suggestion: "Vous pouvez envoyer un message de rappel aux marchands via la messagerie",
        merchants: merchants
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
// 🗑️ AJOUTER dans orderController.js

// Supprimer définitivement une commande annulée
export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier si la commande existe
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                shop: {
                  select: {
                    userId: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ 
        message: "Commande non trouvée" 
      });
    }
    
    // 🔒 VÉRIFICATIONS DE SÉCURITÉ
    
    // 1. Seules les commandes ANNULÉES peuvent être supprimées
    if (order.status !== 'CANCELED') {
      return res.status(400).json({ 
        message: "Seules les commandes annulées peuvent être supprimées définitivement",
        currentStatus: order.status
      });
    }
    
    // 2. Vérifier les permissions
    let isAuthorized = false;
    
    if (userRole === 'CLIENT') {
      // Le client peut supprimer ses propres commandes annulées
      if (order.clientId === userId) {
        isAuthorized = true;
      }
    } 
    else if (userRole === 'MERCHANT') {
      // Le marchand peut supprimer les commandes annulées qui le concernent
      const isMerchantOrder = order.orderItems.some(item => 
        item.product.shop.userId === userId
      );
      if (isMerchantOrder) {
        isAuthorized = true;
      }
    }
    else if (userRole === 'ADMIN') {
      // L'admin peut supprimer toute commande annulée
      isAuthorized = true;
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ 
        message: "Vous n'êtes pas autorisé à supprimer cette commande" 
      });
    }
    
    // 🗑️ SUPPRESSION EN CASCADE
    
    // 1. Supprimer les notifications liées
    await prisma.notification.deleteMany({
      where: {
        resourceType: 'Order',
        resourceId: parseInt(orderId)
      }
    });
    
    // 2. Supprimer les messages liés (si applicable)
    // Note: Seulement si vous avez une relation orderId dans vos messages
    // await prisma.message.deleteMany({
    //   where: { orderId: parseInt(orderId) }
    // });
    
    // 3. Supprimer les items de commande
    await prisma.orderItem.deleteMany({
      where: { orderId: parseInt(orderId) }
    });
    
    // 4. Supprimer la commande elle-même
    await prisma.order.delete({
      where: { id: parseInt(orderId) }
    });
    
    // 📝 LOG DE SÉCURITÉ
    console.log(`🗑️ Commande #${orderId} supprimée définitivement par ${userRole} ${userId}`);
    
    // 🔔 NOTIFICATION OPTIONNELLE
    if (userRole === 'CLIENT') {
      // Notifier que la commande a été supprimée
      await prisma.notification.create({
        data: {
          userId: userId,
          type: 'SYSTEM',
          message: `🗑️ Votre commande annulée #COMANDE-${orderId} a été supprimée définitivement.`,
          priority: 1
        }
      });
    }
    
    return res.status(200).json({
      message: "Commande supprimée définitivement avec succès",
      orderId: parseInt(orderId),
      deletedBy: userRole
    });
    
  } catch (error) {
    console.error("Erreur lors de la suppression de la commande:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la suppression de la commande",
      error: error.message
    });
  }
};

// 🔧 FONCTION UTILITAIRE: Nettoyer les anciennes commandes annulées
export const cleanupOldCanceledOrders = async (req, res) => {
  try {
    // Supprimer les commandes annulées de plus de 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldCanceledOrders = await prisma.order.findMany({
      where: {
        status: 'CANCELED',
        updatedAt: { lte: thirtyDaysAgo }
      },
      select: { id: true }
    });
    
    if (oldCanceledOrders.length === 0) {
      return res.status(200).json({
        message: "Aucune ancienne commande annulée à nettoyer",
        cleaned: 0
      });
    }
    
    const orderIds = oldCanceledOrders.map(order => order.id);
    
    // Supprimer en cascade
    await prisma.notification.deleteMany({
      where: {
        resourceType: 'Order',
        resourceId: { in: orderIds }
      }
    });
    
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    
    const deletedCount = await prisma.order.deleteMany({
      where: { id: { in: orderIds } }
    });
    
    console.log(`🧹 Nettoyage automatique: ${deletedCount.count} commandes annulées supprimées`);
    
    return res.status(200).json({
      message: `Nettoyage terminé: ${deletedCount.count} commandes annulées supprimées`,
      cleaned: deletedCount.count,
      orderIds: orderIds
    });
    
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error);
    return res.status(500).json({
      message: "Erreur lors du nettoyage des anciennes commandes",
      error: error.message
    });
  }
};
// Nouvelle route : GET /merchant/top-products
export const getTopProducts = async (req, res) => {
  try {
    const merchantId = req.user.id;
    
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        product: {
          shop: {
            userId: merchantId
          }
        },
        order: {
          status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } // Seulement vendus
        }
      },
      _sum: {
        quantity: true,
        price: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc' // Tri par quantité vendue
        }
      },
      take: 5
    });

    // Enrichir avec les détails produits
    const enrichedProducts = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            price: true,
            images: { take: 1 }
          }
        });
        
        return {
          product,
          totalSold: item._sum.quantity,
          totalRevenue: item._sum.price,
          orderCount: item._count.id
        };
      })
    );

    return res.status(200).json({ topProducts: enrichedProducts });
  } catch (error) {
    console.error("Erreur top products:", error);
    return res.status(500).json({ error: error.message });
  }
};
// 📊 AJOUTER DANS orderController.js - STATISTIQUES MARCHAND

// Route principale : GET /api/merchant/stats
// 📊 CORRECTION COMPLÈTE de getMerchantStats dans orderController.js

export const getMerchantStats = async (req, res) => {
  try {
    const merchantId = req.user.id;
    console.log('📊 Récupération stats pour marchand:', merchantId);
    
    // Vérifier si l'utilisateur est un marchand
    const merchant = await prisma.user.findUnique({
      where: { id: merchantId },
      include: { shop: true }
    });
    
    if (!merchant || !merchant.shop) {
      return res.status(403).json({ 
        message: "Accès refusé. Vous n'êtes pas un marchand." 
      });
    }
    
    const shopId = merchant.shop.id;
    console.log('🏪 Shop ID:', shopId);
    
    // 💰 1. CALCUL DU CHIFFRE D'AFFAIRES ET NOMBRE DE COMMANDES
    const revenueData = await prisma.orderItem.aggregate({
      where: {
        product: { shopId: shopId },
        order: { 
          status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } 
        }
      },
      _sum: { price: true },
      _count: { id: true }
    });
    
    // 📊 2. COMPTAGE PAR STATUT
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: {
        orderItems: {
          some: {
            product: { shopId: shopId }
          }
        }
      },
      _count: { id: true }
    });
    
    // Organiser les comptes par statut
    let totalOrders = 0;
    let pendingOrders = 0;
    let confirmedOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;
    let canceledOrders = 0;
    
    statusCounts.forEach(status => {
      const count = status._count.id;
      totalOrders += count;
      
      switch (status.status) {
        case 'PENDING': pendingOrders = count; break;
        case 'CONFIRMED': confirmedOrders = count; break;
        case 'SHIPPED': shippedOrders = count; break;
        case 'DELIVERED': deliveredOrders = count; break;
        case 'CANCELED': canceledOrders = count; break;
      }
    });
    
    // 🎯 3. TOP 5 PRODUITS
    const topProductsRaw = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        product: { shopId: shopId },
        order: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } }
      },
      _sum: { 
        quantity: true, 
        price: true // Somme des prix * quantité = revenus pour ce produit
      },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });
    
    // Enrichir avec les détails produits
    const topProducts = await Promise.all(
      topProductsRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, price: true }
        });
        
        return {
          productId: product.id,
          productName: product.name,
          totalSold: item._sum.quantity || 0,
          totalRevenue: item._sum.price || 0, // 🔧 Somme des prix de vente réels
          orderCount: item._count.id || 0
        };
      })
    );
    
    // 📋 4. COMMANDES RÉCENTES (5 dernières)
    const recentOrdersRaw = await prisma.order.findMany({
      where: {
        orderItems: {
          some: {
            product: { shopId: shopId }
          }
        }
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true
          }
        },
        orderItems: {
          where: {
            product: { shopId: shopId }
          },
          select: {
            price: true,
            quantity: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    const recentOrders = recentOrdersRaw.map(order => {
      const totalAmount = order.orderItems.reduce(
        (sum, item) => sum + (item.price * item.quantity), 0
      );
      
      return {
        id: order.id,
        clientName: `${order.client.firstName} ${order.client.lastName}`,
        totalAmount: totalAmount,
        status: order.status,
        createdAt: order.createdAt.toISOString()
      };
    });
    
    // 📈 5. DONNÉES GRAPHIQUE (7 derniers jours) - MÉTHODE CORRIGÉE
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // 🔧 CORRECTION: Récupérer les commandes avec leurs items du marchand
    const ordersWithItems = await prisma.order.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] },
        orderItems: {
          some: {
            product: { shopId: shopId }
          }
        }
      },
      include: {
        orderItems: {
          where: {
            product: { shopId: shopId }
          },
          select: {
            price: true,
            quantity: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Grouper par jour manuellement
    const revenueChart = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Filtrer les commandes de ce jour
      const dayOrders = ordersWithItems.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDay;
      });
      
      // Calculer le revenu du jour
      const dayRevenue = dayOrders.reduce((sum, order) => {
        const orderRevenue = order.orderItems.reduce(
          (orderSum, item) => orderSum + (item.price * item.quantity), 0
        );
        return sum + orderRevenue;
      }, 0);
      
      // Compter les commandes du jour
      const dayOrderCount = dayOrders.length;
      
      revenueChart.push({
        date: date.toISOString(),
        revenue: dayRevenue,
        orderCount: dayOrderCount
      });
    }
    
    // 🧮 6. CALCULS FINAUX
    const totalRevenue = revenueData._sum.price || 0;
    const successfulOrders = deliveredOrders;
    const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // 📦 7. RÉPONSE FINALE
    const stats = {
      totalRevenue,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      canceledOrders,
      successRate,
      averageOrderValue,
      topProducts,
      recentOrders,
      revenueChart
    };
    
    console.log(`📊 Statistiques calculées pour marchand ${merchantId}:`, {
      revenue: totalRevenue,
      orders: totalOrders,
      topProducts: topProducts.length,
      chartPoints: revenueChart.length
    });
    
    return res.status(200).json(stats);
    
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des statistiques",
      error: error.message
    });
  }
};

// 📈 CORRECTION AUSSI POUR getRevenueChart
export const getRevenueChart = async (req, res) => {
  try {
    const merchantId = req.user.id;
    const days = parseInt(req.query.days) || 7;
    
    // Vérifier marchand
    const merchant = await prisma.user.findUnique({
      where: { id: merchantId },
      include: { shop: true }
    });
    
    if (!merchant || !merchant.shop) {
      return res.status(403).json({ 
        message: "Accès refusé. Vous n'êtes pas un marchand." 
      });
    }
    
    const shopId = merchant.shop.id;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 🔧 CORRECTION: Même approche que ci-dessus
    const ordersWithItems = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] },
        orderItems: {
          some: {
            product: { shopId: shopId }
          }
        }
      },
      include: {
        orderItems: {
          where: {
            product: { shopId: shopId }
          },
          select: {
            price: true,
            quantity: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Créer le tableau des jours
    const chartData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Filtrer les commandes de ce jour
      const dayOrders = ordersWithItems.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDay;
      });
      
      // Calculer le revenu du jour
      const dayRevenue = dayOrders.reduce((sum, order) => {
        const orderRevenue = order.orderItems.reduce(
          (orderSum, item) => orderSum + (item.price * item.quantity), 0
        );
        return sum + orderRevenue;
      }, 0);
      
      const dayOrderCount = dayOrders.length;
      
      chartData.push({
        date: date.toISOString(),
        revenue: dayRevenue,
        orderCount: dayOrderCount
      });
    }
    
    return res.status(200).json({ chartData });
    
  } catch (error) {
    console.error("Erreur graphique revenus:", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération du graphique",
      error: error.message
    });
  }
};

// 🔧 FONCTION UTILITAIRE: Calculer les statistiques en cache
export const calculateMerchantStatsCache = async (merchantId) => {
  try {
    // Cette fonction peut être appelée périodiquement pour mettre en cache les stats
    const stats = await getMerchantStats({ user: { id: merchantId } }, {
      status: () => ({ json: () => {} }),
      json: (data) => data
    });
    
    // Sauvegarder en cache (Redis, DB, etc.)
    // await redis.setex(`merchant_stats_${merchantId}`, 3600, JSON.stringify(stats));
    
    return stats;
  } catch (error) {
    console.error(`Erreur cache stats marchand ${merchantId}:`, error);
    return null;
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

  // Fonction pour auto-confirmer après 48h
export const autoConfirmDelivery = async () => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    
    const ordersToConfirm = await prisma.order.findMany({
      where: {
        status: 'SHIPPED',
        updatedAt: { lte: twoDaysAgo }
      }
    });
    
    for (const order of ordersToConfirm) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' }
      });
      
      // Notifier le client et le commerçant
      await prisma.notification.create({
        data: {
          userId: order.clientId,
          type: 'ORDER',
          message: `✅ Votre commande #${order.id} a été automatiquement confirmée comme livrée après 48h. Si problème, contactez le support.`,
          actionUrl: `/commandes/${order.id}`
        }
      });
    }
  } catch (error) {
    console.error('Erreur auto-confirmation:', error);
  }
};
// 🔧 AJOUTER dans orderController.js

// 🆕 NOUVELLE ROUTE : Obtenir les marchands d'une commande avec leurs vrais ID utilisateur
export const getOrderMerchants = async (req, res) => {
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
                id: true,
                name: true,
                price: true,
                images: { take: 1 },
                shop: {
                  select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    userId: true, // 🔧 ID DU PROPRIÉTAIRE DE LA BOUTIQUE
                    owner: {      // 🔧 INFORMATIONS DU MARCHAND
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photo: true,
                        // isOnline: true // Si vous l'ajoutez au schéma
                      }
                    }
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
    
    // 🎯 REGROUPER PAR MARCHAND (userId, pas shopId)
    const merchantsMap = new Map();
    
    order.orderItems.forEach(item => {
      const shop = item.product.shop;
      const merchantUserId = shop.userId; // 🔧 VRAI ID DE L'UTILISATEUR MARCHAND
      
      if (!merchantsMap.has(merchantUserId)) {
        merchantsMap.set(merchantUserId, {
          merchantId: merchantUserId,        // 🔧 ID UTILISATEUR DU MARCHAND
          shopId: shop.id,                   // ID de la boutique
          shopName: shop.name,
          shopPhone: shop.phoneNumber,
          merchantFirstName: shop.owner.firstName,
          merchantLastName: shop.owner.lastName,
          merchantPhoto: shop.owner.photo,
          isOnline: false, // Valeur par défaut
          products: []
        });
      }
      
      // Ajouter le produit à ce marchand
      merchantsMap.get(merchantUserId).products.push({
        id: item.product.id,
        name: item.product.name,
        price: item.price,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        images: item.product.images
      });
    });
    
    const merchants = Array.from(merchantsMap.values());
    
    return res.status(200).json({
      orderId: order.id,
      merchants: merchants
    });
    
  } catch (error) {
    console.error("Erreur lors de la récupération des marchands:", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération des marchands de la commande",
      error: error.message
    });
  }
};

// 🔧 AMÉLIORER checkOrderConfirmation pour retourner les vrais ID utilisateurs
export const checkOrderConfirmationImproved = async (req, res) => {
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
                    userId: true, // 🔧 VRAI ID DU MARCHAND
                    owner: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photo: true,
                      }
                    }
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
    
    // Si la commande est toujours en attente
    if (order.status === 'PENDING') {
      // Obtenir la liste des marchands uniques avec les VRAIS ID utilisateurs
      const merchants = [];
      const merchantIds = new Set();
      
      order.orderItems.forEach(item => {
        const merchantUserId = item.product.shop.userId; // 🔧 VRAI ID UTILISATEUR
        const shopName = item.product.shop.name;
        const merchantInfo = item.product.shop.owner;
        
        if (!merchantIds.has(merchantUserId)) {
          merchantIds.add(merchantUserId);
          merchants.push({
            merchantId: merchantUserId,              // 🔧 VRAI ID UTILISATEUR
            shopId: item.product.shop.id,           // ID de la boutique
            shopName: shopName,
            merchantFirstName: merchantInfo.firstName,
            merchantLastName: merchantInfo.lastName,
            merchantPhoto: merchantInfo.photo,
            isOnline: false
          });
        }
      });
      
      return res.status(200).json({
        message: "Votre commande est toujours en attente de confirmation",
        orderId: order.id,
        status: order.status,
        suggestion: "Vous pouvez envoyer un message de rappel aux marchands via la messagerie",
        merchants: merchants
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
export const sendOrderReminder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const { customMessage } = req.body;
    
    const order = await prisma.order.findFirst({
      where: { 
        id: parseInt(orderId),
        clientId: userId,
        status: 'PENDING' // Seulement pour les commandes en attente
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
                    userId: true
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
      return res.status(404).json({ 
        message: "Commande non trouvée ou déjà traitée" 
      });
    }
    
    // Regrouper par boutique
    const shopItems = {};
    
    order.orderItems.forEach(item => {
      const merchantId = item.product.shop.userId;
      
      if (!shopItems[merchantId]) {
        shopItems[merchantId] = {
          merchantId: merchantId,
          shopName: item.product.shop.name,
          items: []
        };
      }
      
      shopItems[merchantId].items.push({
        name: item.product.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
      });
    });
    
    // Envoyer un rappel à chaque marchand
    const messageResults = [];
    
    for (const merchantId in shopItems) {
      const shop = shopItems[merchantId];
      const shopTotal = shop.items.reduce((sum, item) => sum + item.total, 0);
      
      // Message de rappel
      let messageContent = `⏰ **RAPPEL - Commande #${order.id}**\n\n`;
      messageContent += `Bonjour ! Je vous relance concernant ma commande #${order.id} qui est toujours en attente.\n\n`;
      messageContent += `**Articles commandés :**\n\n`;
      
      shop.items.forEach((item, index) => {
        messageContent += `${index + 1}. **${item.name}**\n`;
        messageContent += `   - Quantité: ${item.quantity}\n`;
        messageContent += `   - Total: ${item.total.toLocaleString()} FCFA\n\n`;
      });
      
      messageContent += `**TOTAL: ${shopTotal.toLocaleString()} FCFA**\n\n`;
      
      if (customMessage) {
        messageContent += `Message: ${customMessage}\n\n`;
      }
      
      messageContent += `Pouvez-vous me confirmer si vous avez bien reçu ma commande et sa disponibilité ?\n\n`;
      messageContent += `Merci !`;
      
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
        
        // Notification
        await prisma.notification.create({
          data: {
            userId: parseInt(merchantId),
            type: "MESSAGE",
            message: `Rappel commande #${order.id} de ${order.client.firstName} ${order.client.lastName}`,
            resourceId: sentMessage.id,
            resourceType: "Message",
            actionUrl: `/messages/${userId}`,
            priority: 2
          }
        });
        
        // Socket.IO
        if (global.io) {
          global.io.to(`user_${merchantId}`).emit('new_message', {
            message: sentMessage,
            sender: {
              id: userId,
              name: `${order.client.firstName} ${order.client.lastName}`
            }
          });
        }
        
        messageResults.push({
          merchantId: parseInt(merchantId),
          shopName: shop.shopName,
          success: true
        });
        
      } catch (error) {
        console.error(`Erreur rappel marchand ${merchantId}:`, error);
        messageResults.push({
          merchantId: parseInt(merchantId),
          shopName: shop.shopName,
          success: false,
          error: error.message
        });
      }
    }
    
    return res.status(200).json({
      message: "Messages de rappel envoyés avec succès",
      results: messageResults
    });
    
  } catch (error) {
    console.error("Erreur lors de l'envoi du rappel:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'envoi du rappel",
      error: error.message
    });
  }
};
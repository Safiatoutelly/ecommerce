
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createNotification = async ({
  userId,
  type,
  message,
  actionUrl = null,
  resourceId = null,
  resourceType = null,
  priority = 0,
  expiresAt = null
}) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        actionUrl,
        resourceId,
        resourceType,
        priority,
        expiresAt,
        isRead: false
      }
    });
    
    return notification;
  } catch (error) {
    console.error("Erreur lors de la création de notification:", error);
    throw error;
  }
};
export const getUserNotifications = async (userId) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' } // Trier par date décroissante
      });
      return notifications;
    } catch (error) {
      console.error("Erreur lors de la récupération des notifications:", error);
      throw error;
    }
  };
  
  // ✅ Marquer une notification comme lue
  export const markNotificationAsRead = async (notificationId) => {
    try {
      const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      });
      return notification;
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la notification:", error);
      throw error;
    }
  };
  
  // ✅ Marquer toutes les notifications comme lues
  export const markAllNotificationsAsRead = async (userId) => {
    try {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
      });
      return { message: "Toutes les notifications ont été marquées comme lues." };
    } catch (error) {
      console.error("Erreur lors de la mise à jour des notifications:", error);
      throw error;
    }
  };
  
  // ✅ Supprimer une notification
  export const deleteNotification = async (notificationId) => {
    try {
      await prisma.notification.delete({
        where: { id: notificationId }
      });
      return { message: "Notification supprimée avec succès." };
    } catch (error) {
      console.error("Erreur lors de la suppression de la notification:", error);
      throw error;
    }
  };
  
  // ✅ Supprimer toutes les notifications d'un utilisateur
  export const deleteAllNotifications = async (userId) => {
    try {
      await prisma.notification.deleteMany({
        where: { userId }
      });
      return { message: "Toutes les notifications ont été supprimées." };
    } catch (error) {
      console.error("Erreur lors de la suppression des notifications:", error);
      throw error;
    }
  };
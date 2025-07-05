import { PrismaClient } from '@prisma/client';
import { sendNotificationToUser } from './socketService.js'; // ✅ Assure-toi que le chemin est correct

const prisma = new PrismaClient();

// ✅ Créer une notification + envoyer en temps réel si l'utilisateur est connecté
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

    // ✅ Envoi temps réel via Socket.IO
    sendNotificationToUser(userId, 'new_notification', notification);

    return notification;
  } catch (error) {
    console.error("Erreur lors de la création de notification:", error);
    throw error;
  }
};

// ✅ Récupérer toutes les notifications d'un utilisateur
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

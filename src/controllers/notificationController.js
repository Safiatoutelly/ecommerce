import {
    getUserNotifications as getUserNotificationsFromService,
    markNotificationAsRead as markNotificationAsReadFromService,
    markAllNotificationsAsRead as markAllNotificationsAsReadFromService,
    deleteNotification as deleteNotificationFromService,
    deleteAllNotifications as deleteAllNotificationsFromService
  } from '../services/notificationService.js';
  
  export const getUserNotifications = async (req, res) => {
    const userId = req.user.id;
    const notifications = await getUserNotificationsFromService(userId);
    res.status(200).json(notifications);
  };
  
  export const markNotificationAsRead = async (req, res) => {
    const { id } = req.params;
    const notification = await markNotificationAsReadFromService(Number(id));
    res.status(200).json(notification);
  };
  
  export const markAllNotificationsAsRead = async (req, res) => {
    const userId = req.user.id;
    const result = await markAllNotificationsAsReadFromService(userId);
    res.status(200).json(result);
  };
  
  export const deleteNotification = async (req, res) => {
    const { id } = req.params;
    const result = await deleteNotificationFromService(Number(id));
    res.status(200).json(result);
  };
  
  export const deleteAllNotifications = async (req, res) => {
    const userId = req.user.id;
    const result = await deleteAllNotificationsFromService(userId);
    res.status(200).json(result);
  };
  
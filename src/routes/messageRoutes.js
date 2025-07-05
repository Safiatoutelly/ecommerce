import express from 'express';
import messageController, { upload } from '../controllers/messageController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Appliquer l'authentification à toutes les routes de messages
router.use(authenticate);

// 🔥 ROUTES POUR LES MESSAGES AVEC SUPPORT AUDIO COMPLET

// Envoyer un nouveau message avec média optionnel (image, vidéo, audio)
router.post('/send', upload.single('media'), messageController.sendMessage);

// Récupérer toutes les conversations de l'utilisateur connecté
router.get('/conversations', messageController.getConversations);

// Récupérer tous les messages d'une conversation spécifique
router.get('/with/:partnerId', messageController.getMessages);

// Mettre à jour le contenu d'un message (seul l'expéditeur peut modifier)
router.put('/:messageId', messageController.updateMessage);

// Supprimer un message (pour moi ou pour tous avec ?forEveryone=true)
router.delete('/:messageId', messageController.deleteMessage);

// Marquer un message spécifique comme lu
router.patch('/:messageId/read', messageController.markAsRead);

// 🔥 NOUVELLES ROUTES AJOUTÉES

// Marquer tous les messages non lus d'une conversation comme lus
router.patch('/read/all/:partnerId', messageController.markAllAsRead);

// Obtenir le nombre total de messages non lus
router.get('/unread/count', messageController.getUnreadCount);

// Rechercher dans les messages par contenu (?query=terme)
router.get('/search', messageController.searchMessages);

export default router;
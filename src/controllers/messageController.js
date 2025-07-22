// messageController.js - VERSION COMPLÈTE AVEC SUPPORT AUDIO

import { PrismaClient } from '@prisma/client';
import { createNotification } from '../services/notificationService.js';
import cloudinary from '../utils/cloudinary.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔥 CONFIGURATION MULTER MISE À JOUR POUR SUPPORTER L'AUDIO
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 🔥 FILTRE DE FICHIERS ÉTENDU POUR SUPPORTER L'AUDIO
const fileFilter = (req, file, cb) => {
  console.log('🔍 [FILE_FILTER] Fichier reçu:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // 🔥 TYPES DE FICHIERS SUPPORTÉS
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const videoTypes = /mp4|mov|avi|webm|mkv/;
  const audioTypes = /mp3|m4a|wav|aac|ogg|opus/; // 🔥 AJOUT AUDIO

  const isImage = file.mimetype.startsWith('image/') && imageTypes.test(path.extname(file.originalname).toLowerCase());
  const isVideo = file.mimetype.startsWith('video/') && videoTypes.test(path.extname(file.originalname).toLowerCase());
  const isAudio = file.mimetype.startsWith('audio/') && audioTypes.test(path.extname(file.originalname).toLowerCase());

  // 🔥 SUPPORT SPÉCIAL POUR M4A (parfois détecté comme video/mp4)
  const isM4A = file.originalname.toLowerCase().endsWith('.m4a') || file.mimetype === 'audio/mp4';

  if (isImage || isVideo || isAudio || isM4A) {
    console.log('✅ [FILE_FILTER] Fichier accepté');
    return cb(null, true);
  }

  console.log('❌ [FILE_FILTER] Fichier rejeté');
  cb(new Error("Seuls les fichiers image (JPEG, PNG, GIF), vidéo (MP4, MOV, AVI, WEBM) et audio (MP3, M4A, WAV, AAC) sont acceptés!"));
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 🔥 AUGMENTÉ À 15MB pour l'audio
  fileFilter: fileFilter
});

const prisma = new PrismaClient();

// 🔥 FONCTION POUR DÉTERMINER LE TYPE DE MÉDIA
function getMediaType(file) {
  console.log('🔍 [MEDIA_TYPE] Analyse du fichier:', {
    mimetype: file.mimetype,
    originalname: file.originalname
  });

  // Audio en premier (important pour M4A)
  if (file.mimetype.startsWith('audio/') || file.originalname.toLowerCase().endsWith('.m4a')) {
    console.log('🎵 [MEDIA_TYPE] Détecté comme AUDIO');
    return 'audio';
  }
  
  if (file.mimetype.startsWith('image/')) {
    console.log('🖼️ [MEDIA_TYPE] Détecté comme IMAGE');
    return 'image';
  }
  
  if (file.mimetype.startsWith('video/')) {
    console.log('🎥 [MEDIA_TYPE] Détecté comme VIDEO');
    return 'video';
  }

  console.log('❓ [MEDIA_TYPE] Type inconnu, défaut: image');
  return 'image'; // Fallback
}

// 🔥 FONCTION POUR UPLOADER SUR CLOUDINARY SELON LE TYPE
async function uploadToCloudinary(filePath, mediaType, originalName) {
  console.log('☁️ [CLOUDINARY] Upload en cours...', {
    filePath,
    mediaType,
    originalName
  });

  let resourceType, folderPath;

  switch (mediaType) {
    case 'audio':
      resourceType = 'video'; // 🔥 Cloudinary traite l'audio comme "video"
      folderPath = 'messages/audio';
      break;
    case 'video':
      resourceType = 'video';
      folderPath = 'messages/videos';
      break;
    case 'image':
    default:
      resourceType = 'image';
      folderPath = 'messages/images';
      break;
  }

  const uploadOptions = {
    folder: folderPath,
    resource_type: resourceType,
    // 🔥 OPTIONS SPÉCIALES POUR L'AUDIO
    ...(mediaType === 'audio' && {
      format: 'mp3', // Convertir en MP3 pour compatibilité
      audio_codec: 'mp3',
      audio_frequency: 44100
    })
  };

  console.log('⚙️ [CLOUDINARY] Options d\'upload:', uploadOptions);

  const result = await cloudinary.uploader.upload(filePath, uploadOptions);
  
  console.log('✅ [CLOUDINARY] Upload réussi:', {
    url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type
  });

  return result;
}

/**
 * Contrôleur pour gérer les messages entre clients et commerçants
 */
export const messageController = {
  /**
   * Envoyer un nouveau message avec possibilité d'inclure un média (image, vidéo, audio)
   */
  sendMessage: async (req, res) => {
    console.log('\n🚀 [SEND_MESSAGE] === DÉBUT ===');
    
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        console.log('❌ [SEND_MESSAGE] Utilisateur non connecté');
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour envoyer un message" 
        });
      }

      const { receiverId, content } = req.body;
      const senderId = req.user.id;
      let mediaUrl = null;
      let mediaType = null;

      console.log('📋 [SEND_MESSAGE] Données reçues:', {
        senderId,
        receiverId,
        content: content ? content.substring(0, 50) + '...' : 'null',
        hasFile: !!req.file
      });

      // Validation des entrées de base
      if (!receiverId) {
        return res.status(400).json({
          success: false,
          message: "Le destinataire est obligatoire"
        });
      }
      
      // Si pas de contenu et pas de fichier, erreur
      if (!content && !req.file) {
        return res.status(400).json({
          success: false,
          message: "Veuillez fournir un message ou un média"
        });
      }

      // Vérifier que le destinataire existe
      const receiver = await prisma.user.findUnique({
        where: { id: parseInt(receiverId, 10) }
      });

      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: "Destinataire non trouvé"
        });
      }

      // Vérifier que l'utilisateur n'essaie pas de s'envoyer un message à lui-même
      if (senderId === parseInt(receiverId, 10)) {
        return res.status(400).json({
          success: false,
          message: "Vous ne pouvez pas vous envoyer un message à vous-même"
        });
      }

      // 🔥 SI UN FICHIER A ÉTÉ UPLOADÉ, LE TRAITER
      if (req.file) {
        console.log('📁 [FILE_PROCESSING] Traitement du fichier...');
        console.log('   📄 Nom original:', req.file.originalname);
        console.log('   📊 Taille:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
        console.log('   🎭 Type MIME:', req.file.mimetype);
        console.log('   📂 Chemin temporaire:', req.file.path);

        try {
          // 🔥 DÉTERMINER LE TYPE DE MÉDIA
          mediaType = getMediaType(req.file);
          
          // 🔥 UPLOADER SUR CLOUDINARY
          const result = await uploadToCloudinary(req.file.path, mediaType, req.file.originalname);
          mediaUrl = result.secure_url;
          
          console.log('✅ [FILE_PROCESSING] Fichier traité avec succès');
          console.log('   🔗 URL Cloudinary:', mediaUrl);
          console.log('   🏷️ Type de média:', mediaType);
          
          // Supprimer le fichier temporaire
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log('🗑️ [FILE_PROCESSING] Fichier temporaire supprimé');
          }
          
        } catch (cloudinaryError) {
          console.error("❌ [CLOUDINARY] Erreur lors de l'upload:", cloudinaryError);
          
          // Supprimer le fichier temporaire en cas d'erreur
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          return res.status(500).json({
            success: false,
            message: "Erreur lors de l'envoi du média",
            error: cloudinaryError.message
          });
        }
      }

      // 🔥 CRÉER LE MESSAGE DANS LA BASE DE DONNÉES
      console.log('💾 [DATABASE] Création du message...');
      const message = await prisma.message.create({
        data: {
          senderId,
          receiverId: parseInt(receiverId, 10),
          content: content || "",
          mediaUrl,
          mediaType,
          isRead: false
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photo: true
            }
          }
        }
      });

      console.log('✅ [DATABASE] Message créé avec ID:', message.id);

      // Créer une notification pour le destinataire
      try {
        await createNotification({
          userId: parseInt(receiverId, 10),
          type: "MESSAGE",
          message: `Nouveau message de ${req.user.firstName} ${req.user.lastName}`,
          resourceId: message.id,
          resourceType: "Message",
          actionUrl: `/messages/${senderId}`,
          priority: 2
        });
        console.log('🔔 [NOTIFICATION] Notification créée');
      } catch (notifError) {
        console.error('⚠️ [NOTIFICATION] Erreur création notification:', notifError);
        // On continue même si la notification échoue
      }

      // Émettre un événement Socket.IO si disponible
      if (global.io) {
        global.io.to(`user_${receiverId}`).emit('new_message', {
          message,
          sender: {
            id: req.user.id,
            name: `${req.user.firstName} ${req.user.lastName}`,
            photo: req.user.photo
          }
        });
        console.log('📡 [SOCKET] Événement émis');
      }

      console.log('🎉 [SEND_MESSAGE] === SUCCÈS ===\n');

      return res.status(201).json({
        success: true,
        message: "Message envoyé avec succès",
        data: message
      });

    } catch (error) {
      console.error("💥 [SEND_MESSAGE] ERREUR FATALE:", error);
      console.error("Stack trace:", error.stack);
      
      // Si un fichier a été uploadé mais qu'une erreur est survenue, nettoyer le fichier
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ [CLEANUP] Fichier temporaire nettoyé après erreur');
      }
      
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de l'envoi du message",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
      });
    }
  },

  /**
   * Récupérer les conversations d'un utilisateur
   */getConversations: async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Vous devez être connecté pour accéder à vos conversations" 
      });
    }

    const userId = req.user.id;
    console.log(`🔄 [getConversations] Récupération conversations pour user ${userId}`);

    // 🔥 APPROCHE SIMPLIFIÉE : Récupérer tous les messages puis traiter en JavaScript
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { 
            senderId: userId,
            deletedForSender: false
          },
          { 
            receiverId: userId,
            deletedForReceiver: false
          }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            role: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 [getConversations] ${messages.length} messages trouvés`);

    // 🔥 GROUPER LES CONVERSATIONS PAR PARTENAIRE
    const conversationsMap = new Map();

    for (const message of messages) {
      // Déterminer qui est le partenaire de conversation
      const isCurrentUserSender = message.senderId === userId;
      const partner = isCurrentUserSender ? message.receiver : message.sender;
      const partnerId = partner.id;

      // Si on n'a pas encore cette conversation, l'initialiser
      if (!conversationsMap.has(partnerId)) {
        conversationsMap.set(partnerId, {
          partnerId: partner.id,
          partnerName: `${partner.firstName} ${partner.lastName}`,
          partnerPhoto: partner.photo,
          partnerRole: partner.role,
          lastMessage: message.content,
          lastMediaUrl: message.mediaUrl,
          lastMediaType: message.mediaType,
          lastMessageTime: message.createdAt,
          unreadCount: 0,
          messages: []
        });
      }

      // Ajouter le message à la conversation
      conversationsMap.get(partnerId).messages.push(message);
    }

    // 🔥 CALCULER LES MESSAGES NON LUS ET FINALISER
    const conversations = Array.from(conversationsMap.values()).map(conversation => {
      // Compter les messages non lus (messages reçus par l'utilisateur actuel)
      const unreadCount = conversation.messages.filter(msg => 
        msg.receiverId === userId && !msg.isRead
      ).length;

      // Le dernier message est déjà le premier (ORDER BY createdAt DESC)
      const lastMessage = conversation.messages[0];

      return {
        partnerId: conversation.partnerId,
        partnerName: conversation.partnerName,
        partnerPhoto: conversation.partnerPhoto,
        partnerRole: conversation.partnerRole,
        lastMessage: lastMessage?.content || '',
        lastMediaUrl: lastMessage?.mediaUrl,
        lastMediaType: lastMessage?.mediaType,
        lastMessageTime: lastMessage?.createdAt,
        unreadCount: unreadCount
      };
    });

    // 🔥 TRIER PAR HEURE DU DERNIER MESSAGE (plus récent en premier)
    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    console.log(`✅ [getConversations] ${conversations.length} conversations retournées`);

    return res.status(200).json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error("💥 [getConversations] Erreur:", error);
    console.error("Stack:", error.stack);
    
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la récupération des conversations",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
},


  /**
   * Récupérer les messages d'une conversation spécifique
   */
  getMessages: async (req, res) => {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour accéder aux messages" 
        });
      }
  
      const userId = req.user.id;
      const { partnerId } = req.params;
      const partnerIdInt = parseInt(partnerId, 10);
  
      if (isNaN(partnerIdInt)) {
        return res.status(400).json({
          success: false,
          message: "ID de partenaire invalide"
        });
      }
  
      // Vérifier que le partenaire existe
      const partner = await prisma.user.findUnique({
        where: { id: partnerIdInt },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photo: true,
          role: true
        }
      });
  
      if (!partner) {
        return res.status(404).json({
          success: false,
          message: "Partenaire de conversation non trouvé"
        });
      }
  
      // 🔥 RÉCUPÉRER TOUS LES MESSAGES (même supprimés) PUIS FILTRER
      const allMessages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: partnerIdInt },
            { senderId: partnerIdInt, receiverId: userId }
          ]
        },
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photo: true
            }
          }
        }
      });
  
      // 🔥 FILTRER LES MESSAGES SUPPRIMÉS POUR L'UTILISATEUR ACTUEL
      const visibleMessages = allMessages.filter(message => {
        // Si je suis l'expéditeur et que j'ai supprimé pour moi → cacher
        if (message.senderId === userId && message.deletedForSender === true) {
          return false;
        }
        
        // Si je suis le destinataire et que j'ai supprimé pour moi → cacher
        if (message.receiverId === userId && message.deletedForReceiver === true) {
          return false;
        }
        
        // Sinon, afficher le message
        return true;
      });
  
      // 🔥 LOG POUR DEBUG
      console.log(`📊 [getMessages] User ${userId} conversation avec ${partnerIdInt}:`);
      console.log(`   📝 Messages total: ${allMessages.length}`);
      console.log(`   👁️ Messages visibles: ${visibleMessages.length}`);
      console.log(`   🗑️ Messages masqués: ${allMessages.length - visibleMessages.length}`);
  
      // Marquer les messages non lus comme lus (seulement les visibles)
      const unreadMessageIds = visibleMessages
        .filter(msg => msg.senderId === partnerIdInt && msg.receiverId === userId && !msg.isRead)
        .map(msg => msg.id);
  
      if (unreadMessageIds.length > 0) {
        await prisma.message.updateMany({
          where: {
            id: { in: unreadMessageIds }
          },
          data: {
            isRead: true
          }
        });
  
        // Notifier via Socket.IO que les messages ont été lus
        if (global.io) {
          global.io.to(`user_${partnerIdInt}`).emit('messages_read', {
            conversationPartnerId: userId
          });
        }
      }
  
      return res.status(200).json({
        success: true,
        data: {
          partner,
          messages: visibleMessages
        }
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des messages:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de la récupération des messages",
        error: error.message
      });
    }
  },

  /**
   * Mettre à jour un message
   */
  updateMessage: async (req, res) => {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour modifier un message" 
        });
      }

      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      // Validation des entrées
      if (!content) {
        return res.status(400).json({
          success: false,
          message: "Le contenu du message est obligatoire"
        });
      }

      const messageIdInt = parseInt(messageId, 10);
      if (isNaN(messageIdInt)) {
        return res.status(400).json({
          success: false,
          message: "ID de message invalide"
        });
      }

      // Vérifier que le message existe et appartient à l'utilisateur
      const message = await prisma.message.findUnique({
        where: { id: messageIdInt }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message non trouvé"
        });
      }

      if (message.senderId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier ce message"
        });
      }

      // Mettre à jour le message
      const updatedMessage = await prisma.message.update({
        where: { id: messageIdInt },
        data: { content }
      });

      // Notifier via Socket.IO que le message a été mis à jour
      if (global.io) {
        global.io.to(`user_${message.receiverId}`).emit('message_updated', {
          message: updatedMessage
        });
      }

      return res.status(200).json({
        success: true,
        message: "Message mis à jour avec succès",
        data: updatedMessage
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du message:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de la mise à jour du message",
        error: error.message
      });
    }
  },

/**
 * Supprimer un message (pour moi ou pour tous)
 */
deleteMessage: async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Vous devez être connecté pour supprimer un message" 
      });
    }

    const { messageId } = req.params;
    const userId = req.user.id;
    const forEveryone = req.query.forEveryone === 'true';

    const messageIdInt = parseInt(messageId, 10);
    if (isNaN(messageIdInt)) {
      return res.status(400).json({
        success: false,
        message: "ID de message invalide"
      });
    }

    // Vérifier que le message existe et appartient à l'utilisateur
    const message = await prisma.message.findUnique({
      where: { id: messageIdInt }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message non trouvé"
      });
    }

    // Vérifier que l'utilisateur est soit l'expéditeur soit le destinataire
    if (message.senderId !== userId && message.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à supprimer ce message"
      });
    }

    // Si "pour tous" est demandé, l'utilisateur doit être l'expéditeur
    if (forEveryone && message.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Seul l'expéditeur peut supprimer le message pour tous"
      });
    }

    if (forEveryone) {
      // 🕰️ VÉRIFICATION DE LA LIMITE DE TEMPS (30 MINUTES)
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes en millisecondes
      
      if (messageAge > thirtyMinutesInMs) {
        return res.status(403).json({
          success: false,
          message: "Vous ne pouvez pas supprimer ce message le temps à passer"
        });
      }

      // Si le message a un média, supprimer de Cloudinary
      if (message.mediaUrl) {
        try {
          // 🔥 SUPPORT SUPPRESSION AUDIO
          let resourceType = 'image';
          if (message.mediaType === 'video') resourceType = 'video';
          if (message.mediaType === 'audio') resourceType = 'video'; // Audio = video dans Cloudinary

          // Extraire l'ID public du média à partir de l'URL
          const publicId = message.mediaUrl.split('/').slice(-2).join('/').split('.')[0];
          if (publicId) {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: resourceType
            });
            console.log(`🗑️ [CLOUDINARY] Fichier ${message.mediaType} supprimé:`, publicId);
          }
        } catch (cloudinaryError) {
          console.error("❌ [CLOUDINARY] Erreur lors de la suppression du média:", cloudinaryError);
          // On continue même si la suppression du média échoue
        }
      }

      // 🔥 TRANSFORMATION DU MESSAGE COMME WHATSAPP (au lieu de supprimer)
      await prisma.message.update({
        where: { id: messageIdInt },
        data: {
          content: 'Ce message a été supprimé',
          mediaUrl: null,
          mediaType: 'text'
        }
      });

      console.log(`✅ [DELETE_FOR_EVERYONE] Message ${messageIdInt} transformé en "Ce message a été supprimé"`);

      // Notifier via Socket.IO que le message a été supprimé
      if (global.io) {
        global.io.to(`user_${message.receiverId}`).emit('message_deleted', {
          messageId: messageIdInt,
          forEveryone: true
        });
        global.io.to(`user_${message.senderId}`).emit('message_deleted', {
          messageId: messageIdInt,
          forEveryone: true
        });
      }
    } else {
      // Supprimer le message uniquement pour l'utilisateur actuel (marquer comme supprimé)
      if (message.senderId === userId) {
        await prisma.message.update({
          where: { id: messageIdInt },
          data: { deletedForSender: true }
        });
        console.log(`✅ [DELETE_FOR_ME] Message ${messageIdInt} supprimé pour l'expéditeur`);
      } else {
        await prisma.message.update({
          where: { id: messageIdInt },
          data: { deletedForReceiver: true }
        });
        console.log(`✅ [DELETE_FOR_ME] Message ${messageIdInt} supprimé pour le destinataire`);
      }

      // Notifier via Socket.IO que le message a été supprimé
      if (global.io) {
        global.io.to(`user_${userId}`).emit('message_deleted', {
          messageId: messageIdInt,
          forEveryone: false
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: forEveryone 
        ? "Message supprimé pour tous les utilisateurs" 
        : "Message supprimé pour vous uniquement"
    });
  } catch (error) {
    console.error("💥 [DELETE_MESSAGE] Erreur lors de la suppression du message:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la suppression du message",
      error: error.message
    });
  }
},

  /**
   * Marquer un message comme lu
   */
  markAsRead: async (req, res) => {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour marquer un message comme lu" 
        });
      }

      const { messageId } = req.params;
      const userId = req.user.id;

      const messageIdInt = parseInt(messageId, 10);
      if (isNaN(messageIdInt)) {
        return res.status(400).json({
          success: false,
          message: "ID de message invalide"
        });
      }

      // Vérifier que le message existe et est destiné à l'utilisateur
      const message = await prisma.message.findUnique({
        where: { id: messageIdInt }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message non trouvé"
        });
      }

      if (message.receiverId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à marquer ce message comme lu"
        });
      }

      // Marquer le message comme lu
      const updatedMessage = await prisma.message.update({
        where: { id: messageIdInt },
        data: { isRead: true }
      });

      // Notifier via Socket.IO que le message a été lu
      if (global.io) {
        global.io.to(`user_${message.senderId}`).emit('message_read', {
          messageId: messageIdInt,
          conversationPartnerId: userId
        });
      }

      return res.status(200).json({
        success: true,
        message: "Message marqué comme lu",
        data: updatedMessage
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors du marquage du message comme lu",
        error: error.message
      });
    }
  },

  /**
   * Marquer tous les messages d'une conversation comme lus
   */
  markAllAsRead: async (req, res) => {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour marquer les messages comme lus" 
        });
      }

      const { partnerId } = req.params;
      const userId = req.user.id;

      const partnerIdInt = parseInt(partnerId, 10);
      if (isNaN(partnerIdInt)) {
        return res.status(400).json({
          success: false,
          message: "ID de partenaire invalide"
        });
      }

      // Marquer tous les messages de cette conversation comme lus
      const result = await prisma.message.updateMany({
        where: {
          senderId: partnerIdInt,
          receiverId: userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });

      // Notifier via Socket.IO que les messages ont été lus
      if (global.io && result.count > 0) {
        global.io.to(`user_${partnerIdInt}`).emit('messages_read', {
          conversationPartnerId: userId
        });
      }

      return res.status(200).json({
        success: true,
        message: `${result.count} message(s) marqué(s) comme lu(s)`,
        count: result.count
      });
    } catch (error) {
      console.error("Erreur lors du marquage des messages comme lus:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors du marquage des messages comme lus",
        error: error.message
      });
    }
  },

  /**
   * Obtenir le nombre de messages non lus
   */
  getUnreadCount: async (req, res) => {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour accéder à vos messages non lus" 
        });
      }

      const userId = req.user.id;

      // Compter les messages non lus
      const unreadCount = await prisma.message.count({
        where: {
          receiverId: userId,
          isRead: false
        }
      });

      return res.status(200).json({
        success: true,
        unreadCount
      });
    } catch (error) {
      console.error("Erreur lors du comptage des messages non lus:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors du comptage des messages non lus",
        error: error.message
      });
    }
  },

  /**
   * Rechercher dans les messages
   */
  searchMessages: async (req, res) => {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Vous devez être connecté pour rechercher des messages" 
        });
      }

      const userId = req.user.id;
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Le terme de recherche est obligatoire"
        });
      }

      // Rechercher dans les messages
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ],
          content: {
            contains: query
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photo: true
            }
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photo: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.status(200).json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error("Erreur lors de la recherche de messages:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de la recherche de messages",
        error: error.message
      });
    }
  }
};

export default messageController;
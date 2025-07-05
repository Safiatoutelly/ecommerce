import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ Map pour stocker les connexions actives
const connectedUsers = new Map();

export const setupSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // ✅ Stocker l'instance IO globalement
  global.io = io;

  // ✅ Authentification middleware Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded || !decoded.userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // ✅ Ajout de l'utilisateur au socket
      socket.userId = decoded.userId;
      socket.userData = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // ✅ Connexion utilisateur
  io.on('connection', (socket) => {
    console.log(`🟢 User connected: ${socket.userId}`);

    // Ajoute dans la Map des utilisateurs connectés
    connectedUsers.set(socket.userId, socket.id);

    // Diffuse statut en ligne
    io.emit('user_status', {
      userId: socket.userId,
      status: 'online'
    });

    // ✅ Écoute message entrant
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, content } = data;
        const senderId = socket.userId;

        const message = await prisma.message.create({
          data: {
            senderId,
            receiverId: parseInt(receiverId, 10),
            content,
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

        const receiverSocketId = connectedUsers.get(parseInt(receiverId, 10));
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', message);
        }

        socket.emit('message_sent', message);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', {
          error: 'Failed to send message',
          details: error.message
        });
      }
    });

    // ✅ Écoute frappe clavier (typing)
    socket.on('typing', (data) => {
      const { receiverId } = data;
      const receiverSocketId = connectedUsers.get(parseInt(receiverId, 10));

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing', {
          userId: socket.userId,
          typing: true
        });
      }
    });

    // ✅ Écoute arrêt frappe
    socket.on('stop_typing', (data) => {
      const { receiverId } = data;
      const receiverSocketId = connectedUsers.get(parseInt(receiverId, 10));

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing', {
          userId: socket.userId,
          typing: false
        });
      }
    });

    // ✅ Marquer message comme lu
    socket.on('mark_as_read', async (data) => {
      try {
        const { messageId } = data;
        const userId = socket.userId;

        const message = await prisma.message.findUnique({
          where: { id: parseInt(messageId, 10) }
        });

        if (message && message.receiverId === userId) {
          const updatedMessage = await prisma.message.update({
            where: { id: parseInt(messageId, 10) },
            data: { isRead: true }
          });

          const senderSocketId = connectedUsers.get(message.senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('message_read', {
              messageId: updatedMessage.id,
              readAt: new Date()
            });
          }
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // ✅ Déconnexion utilisateur
    socket.on('disconnect', () => {
      console.log(`🔴 User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);

      io.emit('user_status', {
        userId: socket.userId,
        status: 'offline'
      });
    });
  });

  return io;
};

// ✅ Fonction pour envoyer une notification en temps réel à un utilisateur
export const sendNotificationToUser = (userId, type, data) => {
  const socketId = connectedUsers.get(userId);
  const io = global.io;

  if (socketId && io) {
    io.to(socketId).emit(type, data);
    return true;
  }

  return false;
};

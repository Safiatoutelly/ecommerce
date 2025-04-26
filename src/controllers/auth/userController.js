import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { sendWelcomeEmail } from '../../services/emailService.js';

const prisma = new PrismaClient();

export const updateProfile = async (req, res) => {
  console.log('Mise à jour du profil - Requête reçue:', {
    body: req.body,
    userId: req.user?.id
  });

  const {
    firstName,
    lastName,
    phoneNumber,
    password,
    country,
    city,
    department,
    commune,
    role,
  } = req.body;

  const userId = req.user.id;

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      console.log(`Utilisateur non trouvé: ${userId}`);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log(`Mise à jour du profil pour l'utilisateur: ${userId}`);

    // Préparer l'objet de données pour la mise à jour
    const updateData = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phoneNumber: phoneNumber || user.phoneNumber,
      country: country || user.country,
      city: city || user.city,
      department: department || user.department,
      commune: commune || user.commune,
      role: role || user.role,
    };

    // Hacher le mot de passe avant de l'enregistrer dans la base de données
    if (password) {
      console.log('Hachage du nouveau mot de passe');
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    // Mettre à jour le profil
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log(`Profil mis à jour avec succès pour l'utilisateur: ${userId}`);

    // Vérifier si le profil est complété pour la première fois (excluding photo)
    const isProfileCompleted =
      updatedUser.firstName &&
      updatedUser.lastName &&
      updatedUser.phoneNumber &&
      updatedUser.password &&
      updatedUser.country &&
      updatedUser.city &&
      updatedUser.department &&
      updatedUser.commune &&
      updatedUser.role;

    if (isProfileCompleted && !user.isProfileCompleted) {
      console.log(`Marquage du profil comme complet pour l'utilisateur: ${userId}`);
      await prisma.user.update({
        where: { id: userId },
        data: { isProfileCompleted: true },
      });

      // Envoyer l'email de bienvenue
      console.log(`Envoi de l'email de bienvenue à: ${updatedUser.email}`);
      await sendWelcomeEmail(updatedUser.email, updatedUser.firstName);
    }

    // Exclure le mot de passe de la réponse pour des raisons de sécurité
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
  }
};

export const getProfile = async (req, res) => {
  const userId = req.user.id;
  console.log(`Récupération du profil pour l'utilisateur: ${userId}`);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log(`Profil non trouvé pour l'utilisateur: ${userId}`);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Exclure le mot de passe de la réponse
    const { password, ...userWithoutPassword } = user;

    console.log(`Profil récupéré avec succès pour l'utilisateur: ${userId}`);
    res.status(200).json({
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  const userId = req.user.id;
  const photoUrl = req.file?.path; // Assumant que vous utilisez multer ou un middleware similaire
  
  console.log(`Téléchargement de photo pour l'utilisateur: ${userId}`);

  if (!photoUrl) {
    console.log('Aucune photo fournie dans la requête');
    return res.status(400).json({ message: 'Aucune photo fournie' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { photo: photoUrl }
    });

    console.log(`Photo mise à jour avec succès pour l'utilisateur: ${userId}`);
    res.status(200).json({
      message: 'Photo de profil mise à jour avec succès',
      photoUrl: updatedUser.photo
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la photo:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la photo' });
  }
};
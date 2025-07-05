-- ✅ CONTENU À METTRE DANS LE FICHIER migration.sql

-- Ajouter isOnline au modèle User
ALTER TABLE `User` ADD COLUMN `isOnline` BOOLEAN NOT NULL DEFAULT false;

-- Modifier le type de content dans Message pour supporter les longs textes
ALTER TABLE `Message` MODIFY COLUMN `content` TEXT NOT NULL;

-- Ajouter updatedAt si ce n'est pas déjà fait
ALTER TABLE `Message` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- Mettre à jour les messages existants avec la date de création
UPDATE `Message` SET `updatedAt` = `createdAt` WHERE `updatedAt` IS NULL;
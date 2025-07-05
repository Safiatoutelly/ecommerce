-- AlterTable
ALTER TABLE `Message` ADD COLUMN `deletedForReceiver` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `deletedForSender` BOOLEAN NOT NULL DEFAULT false;

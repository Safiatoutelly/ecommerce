/*
  Warnings:

  - You are about to drop the column `isRead` on the `MerchantContact` table. All the data in the column will be lost.
  - You are about to drop the column `senderName` on the `MerchantContact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `MerchantContact` DROP COLUMN `isRead`,
    DROP COLUMN `senderName`,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'UNREAD';

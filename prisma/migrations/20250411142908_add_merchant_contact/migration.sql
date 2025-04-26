-- CreateTable
CREATE TABLE `MerchantContact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `merchantId` INTEGER NOT NULL,
    `senderName` VARCHAR(191) NOT NULL,
    `senderEmail` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MerchantContact` ADD CONSTRAINT `MerchantContact_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantContact` ADD CONSTRAINT `MerchantContact_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

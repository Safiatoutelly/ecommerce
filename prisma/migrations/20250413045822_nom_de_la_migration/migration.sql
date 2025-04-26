-- DropForeignKey
ALTER TABLE `MerchantContact` DROP FOREIGN KEY `MerchantContact_merchantId_fkey`;

-- DropForeignKey
ALTER TABLE `MerchantContact` DROP FOREIGN KEY `MerchantContact_shopId_fkey`;

-- CreateTable
CREATE TABLE `MerchantContactResponse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantContactId` INTEGER NOT NULL,
    `merchantId` INTEGER NOT NULL,
    `response` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MerchantContact` ADD CONSTRAINT `MerchantContact_shop_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantContact` ADD CONSTRAINT `MerchantContact_merchant_receiver_fkey` FOREIGN KEY (`merchantId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantContact` ADD CONSTRAINT `MerchantContact_merchant_sender_fkey` FOREIGN KEY (`merchantId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantContactResponse` ADD CONSTRAINT `MerchantContactResponse_merchantContact_fkey` FOREIGN KEY (`merchantContactId`) REFERENCES `MerchantContact`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantContactResponse` ADD CONSTRAINT `MerchantContactResponse_merchant_fkey` FOREIGN KEY (`merchantId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

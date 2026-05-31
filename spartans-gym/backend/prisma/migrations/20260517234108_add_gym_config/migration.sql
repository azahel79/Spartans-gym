-- CreateTable
CREATE TABLE `gym_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL DEFAULT 'SPARTAN''S GYM',
    `email` VARCHAR(191) NOT NULL DEFAULT 'contacto@spartansgym.com',
    `phone` VARCHAR(191) NOT NULL DEFAULT '+52 55 1234 5678',
    `address` VARCHAR(191) NOT NULL DEFAULT 'Avenida de los Deportes 123, Ciudad de México',
    `logo` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

/*
  Warnings:

  - You are about to drop the column `email` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `clients` DROP COLUMN `email`,
    ADD COLUMN `genero` ENUM('Masculino', 'Femenino', 'Otro') NOT NULL DEFAULT 'Masculino';

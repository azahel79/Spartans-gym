// src/config/database.ts
import { PrismaClient } from '@prisma/client'; 

// PrismaClient se conecta automáticamente a la BD usando DATABASE_URL del .env
export const prisma = new PrismaClient();

// Función para probar la conexión
export async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Conexión a MySQL exitosa');
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error);
    process.exit(1);
  }
}
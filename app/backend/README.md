# Gym Backend

API REST construida con Node.js, Express, Prisma y Supabase PostgreSQL.

## Stack

- Node.js 20
- Express
- Prisma 5
- Supabase PostgreSQL
- JWT
- Cloudinary para imágenes, opcional

## Configuración

1. Copia `.env.example` como `.env`.
2. En Supabase abre `Project Settings > Database > Connect`.
3. Copia la conexión `Session pooler` en `DATABASE_URL`.
4. Copia la conexión directa en `DIRECT_URL`.
5. Reemplaza `[YOUR-PASSWORD]` con la contraseña de la base de datos.

```env
PORT=3100
NODE_ENV=development
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
JWT_SECRET="una-clave-segura-de-al-menos-32-caracteres"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:5173"
ALLOWED_ORIGINS="http://localhost:5173"
```

Nunca expongas `DATABASE_URL`, `DIRECT_URL` ni `JWT_SECRET` en el frontend.

## Primera instalación en Supabase

```bash
npm install
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run dev
```

La migración crea las tablas en Supabase. El seed crea el administrador y los planes iniciales.

## Desarrollo

```bash
npm run dev
```

Health check:

```text
http://localhost:3100/api/health
```

## Producción

Build:

```bash
npm run prisma:generate
npm run build
```

Despliegue de migraciones:

```bash
npm run prisma:deploy
```

El `Dockerfile` ya ejecuta las migraciones antes de iniciar la API.

## Prisma Studio

Además del panel de Supabase, puedes administrar registros con:

```bash
npm run prisma:studio
```

La estructura de tablas debe modificarse con `schema.prisma` y migraciones. El Table Editor de Supabase se recomienda para consultar o corregir datos, no para alterar manualmente el esquema administrado por Prisma.

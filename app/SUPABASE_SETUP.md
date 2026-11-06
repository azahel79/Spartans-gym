# Configuración inicial de Supabase

Esta guía conecta el backend Node.js existente con PostgreSQL de Supabase. No utiliza Supabase Auth todavía; el login JWT actual continúa funcionando.

## 1. Crear el proyecto

1. Entra en https://supabase.com/dashboard.
2. Selecciona `New project`.
3. Elige la organización y asigna un nombre al proyecto.
4. Genera y guarda una contraseña fuerte para la base de datos.
5. Elige la región más cercana al gimnasio.
6. Espera a que el proyecto termine de prepararse.

## 2. Obtener las conexiones

En el proyecto abre:

```text
Project Settings > Database > Connect
```

Necesitas dos URLs:

- `DATABASE_URL`: conexión `Session pooler`, puerto `5432`.
- `DIRECT_URL`: conexión directa, puerto `5432`.

Si la conexión directa no funciona por una red sin IPv6, usa también la URL del `Session pooler` como `DIRECT_URL`.

Reemplaza el marcador de contraseña que muestra Supabase con la contraseña real de la base de datos. Si contiene caracteres especiales, usa la contraseña ya codificada que ofrece el panel o codifícala para una URL.

## 3. Crear el archivo backend/.env

Copia `backend/.env.example` como `backend/.env` y completa:

```env
NODE_ENV=development
PORT=3100

DATABASE_URL="URL_SESSION_POOLER"
DIRECT_URL="URL_DIRECTA_O_SESSION_POOLER"

JWT_SECRET="GENERA_UNA_CLAVE_ALEATORIA_DE_32_O_MAS_CARACTERES"
JWT_EXPIRES_IN="7d"

FRONTEND_URL="http://localhost:5173"
ALLOWED_ORIGINS="http://localhost:5173"

SEED_ADMIN_EMAIL="admin@tu-gimnasio.com"
SEED_ADMIN_PASSWORD="CAMBIA_ESTA_PASSWORD"
```

No copies estas variables al frontend y no subas `.env` a Git.

## 4. Crear tablas y datos iniciales

Abre una terminal en `app/backend`:

```bash
npm install
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run seed
```

`prisma:deploy` aplica la migración PostgreSQL incluida. `seed` crea el administrador y los planes iniciales.

## 5. Verificar en Supabase

En `Table Editor` deben aparecer:

- users
- clients
- products
- transactions
- attendances
- gym_config
- plans
- _prisma_migrations

La migración activa Row Level Security sin políticas públicas. El navegador se comunica con Express, no directamente con la Data API de Supabase.

## 6. Ejecutar la aplicación

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Prueba:

```text
http://localhost:3100/api/health
http://localhost:5173
```

Inicia sesión usando `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.

## 7. Cambios futuros del esquema

Modifica `backend/prisma/schema.prisma` y crea una migración:

```bash
npm run prisma:migrate -- --name descripcion_del_cambio
```

En producción aplica cambios con:

```bash
npm run prisma:deploy
```

Evita crear o eliminar columnas manualmente desde Table Editor porque Prisma perdería la historia del esquema.

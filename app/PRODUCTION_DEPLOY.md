# Despliegue en producción

## Servicios

- Base de datos: Supabase PostgreSQL.
- Backend Node.js: Railway, Render, Fly.io o un VPS.
- Frontend estático: Netlify o Vercel.
- Cloudinary opcional para imágenes.

## Supabase

Desde `backend`, con las conexiones reales en `.env`:

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run seed
```

Después revisa las tablas desde `Table Editor` en Supabase.

## Backend

Variables requeridas:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=CONEXION_SESSION_POOLER_DE_SUPABASE
DIRECT_URL=CONEXION_DIRECTA_DE_SUPABASE
JWT_SECRET=CLAVE_ALEATORIA_DE_AL_MENOS_32_CARACTERES
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://tu-frontend.com
ALLOWED_ORIGINS=https://tu-frontend.com
```

Build:

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run build
```

Inicio:

```bash
npm start
```

Health check:

```text
GET /api/health
```

## Frontend

Variable:

```env
VITE_API_URL=https://tu-backend.com/api
```

Desde `frontend`:

```bash
npm install
npm run build
```

Publica la carpeta `frontend/dist`.

## Checklist

- Las migraciones aparecen como aplicadas.
- El seed creó el administrador y los planes.
- Login, clientes, asistencias y renovaciones funcionan.
- Las ventas descuentan inventario.
- Historial y dashboard cargan información.
- El frontend está incluido en `ALLOWED_ORIGINS`.
- No se publicaron archivos `.env`.
- Los respaldos de Supabase están configurados de acuerdo con el plan contratado.

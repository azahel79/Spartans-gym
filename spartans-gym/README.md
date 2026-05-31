# Spartans Gym

Sistema web para gestion de gimnasio: recepcion, clientes, asistencias, membresias, punto de venta, inventario, historial, dashboard, exportaciones CSV, recibos y modo oscuro.

## Estructura

```text
spartans-gym/
  backend/                 API Express + Prisma + MySQL
  frontend-spartans-gym/   React + Vite + Tailwind
  PRODUCTION_DEPLOY.md     Guia completa de despliegue
```

## Requisitos

- Node.js 20+
- MySQL 8+
- Docker Desktop, opcional para probar backend en contenedor
- Cuenta Cloudinary, opcional para imagenes/logo/productos

## Variables De Entorno

No subas archivos `.env` reales a GitHub.

Usa estas plantillas:

- `backend/.env.example`
- `frontend-spartans-gym/.env.example`

Backend local recomendado:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=mysql://root:TU_PASSWORD@localhost:3306/gym_database
JWT_SECRET=mi_clave_secreta_super_segura_para_jwt_2025
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Backend en Docker local:

```env
DATABASE_URL=mysql://root:TU_PASSWORD@host.docker.internal:3306/gym_database
```

Frontend local:

```env
VITE_API_URL=http://localhost:3000/api
```

Si usas Docker exponiendo `3001:3000`, usa:

```env
VITE_API_URL=http://localhost:3001/api
```

## Desarrollo Local

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Frontend:

```bash
cd frontend-spartans-gym
npm install
npm run dev
```

URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3000/api/health
```

## Docker Backend Local

Desde la raiz `spartans-gym`:

```bash
docker build --no-cache -t spartans-backend ./backend
docker run --rm --env-file ./backend/.env -p 3001:3000 spartans-backend
```

Prueba:

```text
http://localhost:3001/api/health
```

Notas:

- Si MySQL corre en tu PC y el backend va dentro de Docker, usa `host.docker.internal` en `DATABASE_URL`.
- Si el puerto `3000` esta ocupado, usa `3001:3000`.

## Produccion

Recomendado:

- Backend: Railway con Docker.
- Base de datos: MySQL en Railway.
- Frontend: Netlify, Vercel o Cloudflare Pages.

Lee:

```text
PRODUCTION_DEPLOY.md
```

## Comandos De Verificacion

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend-spartans-gym
npm run build
```

## Checklist Antes De Subir A GitHub

- No existe `.env` trackeado.
- No existe `node_modules` trackeado.
- No existe `dist` trackeado.
- `backend/.env.example` esta actualizado.
- `frontend-spartans-gym/.env.example` esta actualizado.
- Docker local responde `success: true` en `/api/health`.
- Builds de frontend y backend pasan.

# Spartans Gym Backend

API REST para Spartans Gym construida con Express, Prisma y MySQL.

## Stack

- Node.js 20
- Express
- Prisma
- MySQL
- JWT
- Cloudinary para imagenes, opcional
- Docker listo para Railway

## Variables

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Configura:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=mysql://root:TU_PASSWORD@localhost:3306/gym_database
JWT_SECRET=mi_clave_secreta_super_segura_para_jwt_2025
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

Para Docker local con MySQL en tu computadora:

```env
DATABASE_URL=mysql://root:TU_PASSWORD@host.docker.internal:3306/gym_database
```

## Desarrollo

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Health check:

```text
http://localhost:3000/api/health
```

## Docker Local

Desde la raiz del repo:

```bash
docker build --no-cache -t spartans-backend ./backend
docker run --rm --env-file ./backend/.env -p 3001:3000 spartans-backend
```

Health check:

```text
http://localhost:3001/api/health
```

## Railway Con Docker

Configura el servicio:

```text
Root Directory: backend
Dockerfile Path: Dockerfile
```

Variables:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=${{MySQL.DATABASE_URL}}
JWT_SECRET=una_clave_larga_de_mas_de_32_caracteres
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://tu-frontend.netlify.app
ALLOWED_ORIGINS=https://tu-frontend.netlify.app
```

El contenedor ejecuta automaticamente:

```bash
npx prisma migrate deploy && npm start
```

## Seed Inicial

En Railway o local:

```bash
npm run seed
```

Variables opcionales:

```env
SEED_ADMIN_EMAIL=admin@spartansgym.com
SEED_ADMIN_PASSWORD=una_password_segura
```

Cambia la password despues del primer login.

## Build

```bash
npm run build
```

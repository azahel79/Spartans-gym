# Sistema de GestiÃ³n para Gimnasio

AplicaciÃ³n web para recepciÃ³n, clientes, asistencias, membresÃ­as, punto de venta, inventario, historial, dashboard, recibos y configuraciÃ³n.

El administrador puede personalizar desde `ConfiguraciÃ³n > Apariencia y Marca`:

- Colores y paletas.
- Estilo e imagen del sidebar.
- Fondo y textos del login.
- Intensidad de animaciones.
- Redondeado general de componentes.
- Vista previa antes de publicar.


## Documentacion tecnica

- [Arquitectura tecnica](docs/ARQUITECTURA.md): mapa completo del frontend, backend, rutas, controllers, services, stores, base de datos y reglas para seguir desarrollando sin desordenar el proyecto.
- [Configuracion de Supabase](SUPABASE_SETUP.md): conexion y preparacion de PostgreSQL.
- [Configuracion de WhatsApp](WHATSAPP_SETUP.md): plantillas, variables y flujo de notificaciones automaticas.

## Arquitectura

```text
React + Vite
      |
Node.js + Express
      |
Prisma
      |
Supabase PostgreSQL
```

Supabase aloja y permite administrar PostgreSQL. La API y las reglas del negocio continÃºan en Node.js/Express.

## Estructura

```text
app/
  backend/    API Express + Prisma + Supabase PostgreSQL
  frontend/   React + Vite + Tailwind
```

## Requisitos

- Node.js 20+
- Proyecto gratuito o de pago en Supabase
- Cuenta Cloudinary, opcional para imÃ¡genes

## Inicio rÃ¡pido

Backend:

```bash
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

URLs locales:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3100/api/health
```

Consulta [SUPABASE_SETUP.md](SUPABASE_SETUP.md) para conectar por primera vez el proyecto y crear las tablas.

Consulta [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) para activar recordatorios automÃ¡ticos por WhatsApp.

## Variables principales

Backend:

```env
DATABASE_URL="CONEXION_SESSION_POOLER_DE_SUPABASE"
DIRECT_URL="CONEXION_DIRECTA_DE_SUPABASE"
JWT_SECRET="CLAVE_DE_AL_MENOS_32_CARACTERES"
FRONTEND_URL="http://localhost:5173"
ALLOWED_ORIGINS="http://localhost:5173"
```

Frontend:

```env
VITE_API_URL=http://localhost:3100/api
```

Las conexiones de Supabase pertenecen Ãºnicamente al backend.

## VerificaciÃ³n

```bash
cd backend
npm run prisma:validate
npm run test
npm run build
npm audit --audit-level=high

cd ../frontend
npm run lint
npm run build
npm audit --audit-level=high
```

Con backend y Supabase activos, la prueba transaccional temporal se ejecuta con:

```bash
cd backend
npm run test:smoke
```


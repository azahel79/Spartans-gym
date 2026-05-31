# Spartans Gym Frontend

Aplicacion React/Vite para el sistema Spartans Gym.

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- Axios

## Variables

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Local con backend directo:

```env
VITE_API_URL=http://localhost:3000/api
```

Local con backend Docker expuesto en `3001`:

```env
VITE_API_URL=http://localhost:3001/api
```

Produccion:

```env
VITE_API_URL=https://tu-backend.up.railway.app/api
```

## Desarrollo

```bash
npm install
npm run dev
```

URL local:

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

La salida queda en:

```text
dist/
```

## Deploy En Netlify

Configuracion:

```text
Base directory: frontend-spartans-gym
Build command: npm run build
Publish directory: frontend-spartans-gym/dist
```

Variable:

```env
VITE_API_URL=https://tu-backend.up.railway.app/api
```

El archivo `public/_redirects` ya esta configurado para SPA fallback.

## Deploy En Vercel

Configuracion:

```text
Root directory: frontend-spartans-gym
Build command: npm run build
Output directory: dist
```

Variable:

```env
VITE_API_URL=https://tu-backend.up.railway.app/api
```

El archivo `vercel.json` ya esta configurado para SPA fallback.

## Despues De Publicar

Cuando tengas la URL final del frontend, actualiza en Railway:

```env
FRONTEND_URL=https://tu-frontend.netlify.app
ALLOWED_ORIGINS=https://tu-frontend.netlify.app
```

Luego redeploy del backend.

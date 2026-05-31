# Spartans Gym - Production Deploy

## 1. Required Services

- MySQL database.
- Node hosting for `backend`.
- Static hosting for `frontend-spartans-gym`.
- Cloudinary account if product/logo uploads are used.
- Domain with HTTPS enabled.

## 2. Backend Environment

Create production variables from `backend/.env.example`.

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET` with at least 32 characters
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`

Uploads:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Initial admin seed:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

## 3. Frontend Environment

Create production variables from `frontend-spartans-gym/.env.example`.

Required:

- `VITE_API_URL=https://YOUR_BACKEND_DOMAIN/api`

## 4. Database Setup

From `backend`:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run seed
npm run build
npm start
```

Change the seeded admin password after first login.

## 5. Backend Deploy

Recommended build command:

```bash
npm install && npm run prisma:generate && npx prisma migrate deploy && npm run build
```

Recommended start command:

```bash
npm start
```

Health check:

```text
GET /api/health
```

## 6. Frontend Deploy

From `frontend-spartans-gym`:

```bash
npm install
npm run build
```

Publish:

```text
frontend-spartans-gym/dist
```

For SPA hosting, configure fallback rewrites to `index.html`.

Examples:

- Vercel/Netlify/Cloudflare Pages: publish `dist`.
- VPS/Nginx: serve `dist` and proxy `/api` to the backend if using one domain.

## 7. CORS

`ALLOWED_ORIGINS` must include every frontend origin:

```text
https://your-domain.com,https://www.your-domain.com
```

Do not use `*` with authenticated requests.

## 8. Final Production Checklist

- Login works with seeded admin.
- Create a receptionist user.
- Create/edit plans.
- Register a new client.
- Register attendance.
- Renew membership.
- Sell POS products with `Efectivo` and `Tarjeta`.
- History filters work.
- CSV export works.
- Receipts/tickets open and print.
- Dark mode persists after refresh.
- Mobile `375 x 667`, tablet `768 x 1024`, iPad Pro, desktop verified.
- Cloudinary upload works.
- `GET /api/health` returns success.
- Database backups are enabled.

## 9. Backup Recommendation

Configure automatic MySQL backups at least once per day.

Keep:

- Last 7 daily backups.
- Last 4 weekly backups.
- Last 3 monthly backups.

## 10. Security Notes

- Never commit `.env`.
- Rotate `JWT_SECRET` if it was ever exposed.
- Use HTTPS only.
- Keep admin password strong.
- Keep database access restricted by IP if your provider supports it.

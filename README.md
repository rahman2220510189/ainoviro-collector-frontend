# ainoviro Lead Collector: frontend

Next.js (App Router) + Tailwind + TanStack Query. **UI only**: no API routes, no server
actions. Every request goes through `src/lib/api.ts` (the only axios instance) to the
backend REST API.

## Setup

```cmd
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000 (the backend must run too: `cd backend` → `npm run dev`).

## Environment

| Variable | Example | Note |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api/v1` | Baked in at **build time**: after a change restart `npm run dev` or rebuild. |

The backend's `CORS_ORIGIN` must be this app's address (default `http://localhost:3000`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## How the API layer works

- Cookies are sent with every request (`withCredentials`): the login session is an httpOnly cookie.
- Every request carries `X-Requested-With: XMLHttpRequest` (the backend's CSRF check).
- 401 → back to `/login` (and back to the page after login).
- Error code `QUOTA_PAUSED` → the quota modal opens.
- Other errors → one toast with the backend's message.
- CSV downloads use `responseType: 'blob'` and the filename from `Content-Disposition`: one click, no dialog.

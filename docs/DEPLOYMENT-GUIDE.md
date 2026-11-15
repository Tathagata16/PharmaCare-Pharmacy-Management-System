# PharmaCare Deployment Guide

This guide documents commands provided by the repository and the supplied
frontend and backend deployment URLs. The live health endpoint and frontend
CORS preflight were checked during documentation; this does not verify every
authenticated workflow.
Provider dashboards, plan availability, quotas, and pricing change; confirm
current provider terms before selecting a free tier.

## 1. Prerequisites

- Git.
- Node.js 20.19+ or 22.12+ (or a current Node release compatible with the
  installed Vite 8 toolchain).
- npm.
- MongoDB local instance or MongoDB Atlas deployment supporting transactions
  through a replica set or `mongos`.
- Browser for the client and a private terminal for initial admin creation.

The repository contains independent `client/` and `server/` package
manifests, lockfiles, and scripts; there is no root `package.json`.

## 2. Clone and install

```sh
git clone https://github.com/sourodip19/PharmaCare-Pharmacy-Management-System.git
cd PharmaCare-Pharmacy-Management-System

cp server/.env.example server/.env
cp client/.env.example client/.env

npm ci --prefix server
npm ci --prefix client
```

For local development, create the environment files from the examples and
replace example values as needed. Do not commit populated `.env` files.

## 3. MongoDB Atlas configuration

1. Create an Atlas project and cluster whose topology supports multi-document
   transactions (replica set or `mongos`).
2. Create a database user with a strong unique password and only the database
   privileges required by this application.
3. Configure Atlas Network Access to allow the backend's egress IP address.
   Avoid broad public network access for production.
4. Copy the Atlas connection string and replace placeholders using the Atlas
   console. URL-encode special characters in the database password.
5. Set the complete URI as the backend `MONGODB_URI`, preferably through the
   hosting provider's secret/environment-variable facility.
6. After starting the API, verify `GET /api/health` reports
   `{"status":"ok","database":"connected"}`.

Do not paste connection strings, usernames, or passwords into client-side
environment variables, source files, commits, tickets, or screenshots.

## 4. Environment variables

### Backend

`server/src/config/env.js` validates configuration during server startup.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` |
| `PORT` | No | `5001` | HTTP port; hosting platforms commonly provide this dynamically |
| `MONGODB_URI` | Yes | None | MongoDB connection string; keep secret |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Exact frontend origin allowed by CORS |
| `JWT_SECRET` | Yes | None | Private signing secret, at least 32 characters |
| `JWT_ACCESS_TOKEN_TTL` | No | `15m` | Token expiry using integer plus `s`, `m`, `h`, or `d` |
| `SALES_TAX_RATE` | No | `0` | Fraction from 0 to 1 used for sales calculations |
| `MAX_SALE_DISCOUNT_PERCENT` | No | `20` | Discount ceiling as a percentage from 0 to 100 |
| `PHARMACY_NAME` | No | `PharmaCare Pharmacy` | Name printed on invoices, 1–160 characters |

Generate a unique, random JWT secret with a trusted local secret generator
or a hosting platform's secret manager. Never reuse the example value.

### Frontend

Vite client variables are embedded at build time and must not contain secrets.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | Development: `http://localhost:5001/api`; production fallback: `https://pharmacare-pharmacy-management-system-4tou.onrender.com/api` | Public URL of the deployed API including `/api`; set this in Vercel if overriding the production fallback |
| `VITE_CURRENCY` | `USD` | Currency code used by the UI formatter |

Set production values before running the frontend build. Changing them after
the static files are built does not update the existing output.

## 5. Database initialization and seed data

The API connects to MongoDB on startup. Mongoose creates collections and
indexes as models are used; there is no separate migration command in the
repository.

To insert the demo catalog and sample records:

```sh
npm run seed --prefix server
```

The seed is designed to upsert demo records without replacing existing
records with the same keys. It creates categories, suppliers, medicines, and
priced starter batches, including 100 illustrative medicines. It does not
create an administrator or sample sales/purchase transaction history.
Descriptions and prices are synthetic demonstration data, not medical
guidance. Run only against the database you intend to initialize.

Create the first administrator from an interactive terminal after backend
configuration:

```sh
npm run create-admin --prefix server
```

The script prompts for name, email, and a hidden password; it refuses to
create another administrator if an admin already exists. On a hosted platform,
run it once from an interactive shell/console with access to the configured
production environment. Do not place admin credentials in deployment
configuration or documentation.

## 6. Running in development mode

From the repository root, start the backend and frontend in separate
terminals:

```sh
npm run dev --prefix server
```

```sh
npm run dev --prefix client
```

The API defaults to `http://localhost:5001`, and Vite typically prints its
local URL (commonly `http://localhost:5173`). Configure `CLIENT_ORIGIN` to the
client origin and `VITE_API_URL` to the API's `/api` base URL when they differ.

Useful local checks:

```sh
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
```

## 7. Build the frontend

The project deployment uses:

- Frontend: `https://pharma-care-pharmacy-management-sys-lemon.vercel.app/`
- Backend API base: `https://pharmacare-pharmacy-management-system-4tou.onrender.com/api`

In production, the client uses that backend API base if `VITE_API_URL` is
unset or is set to a localhost URL. Set any non-local Vercel `VITE_API_URL` to
the URL above. Development continues to default to the local API.

```sh
npm run build --prefix client
```

Vite emits static files to `client/dist/`. Deploy that directory using a
static web host that supports SPA fallback routing. Set
`VITE_API_URL=https://<public-api-host>/api` and `VITE_CURRENCY` in the
frontend build environment before running the command. Do not provide
`MONGODB_URI` or `JWT_SECRET` to the frontend build.

## 8. Start the production backend

The backend's configured production script is:

```sh
npm start --prefix server
```

Configure the backend hosting service with the server environment variables
above. Set `NODE_ENV=production` and use the `PORT` assigned by the hosting
platform. The app binds to the configured port in `server/src/server.js`.
Use a persistent Node.js service that supports long-running Express processes
and MongoDB network access. The codebase does not provide a serverless
adapter, Dockerfile, process manager configuration, or deployment manifest.

## 9. Production CORS configuration

The project frontend deployment URL:

```text
https://pharma-care-pharmacy-management-sys-lemon.vercel.app/
```

The project backend deployment URL:

```text
https://pharmacare-pharmacy-management-system-4tou.onrender.com/
```

Set the backend's `CLIENT_ORIGIN` to the frontend origin (scheme and host,
without a trailing slash or API path):

```text
CLIENT_ORIGIN=https://pharma-care-pharmacy-management-sys-lemon.vercel.app
```

The server allows this exact configured origin. In non-production mode it
also allows the built-in Vite localhost origins. Production should use HTTPS
and the exact deployed client origin. Do not use wildcard origins with
authenticated requests.

If Vercel has `VITE_API_URL` configured to a non-local value, set it to
`https://pharmacare-pharmacy-management-system-4tou.onrender.com/api`. The
current backend preflight check accepts the configured Vercel origin. Its
health endpoint reported HTTP 200 and a connected database when checked;
authenticated workflows still need end-to-end verification.

## 10. Suggested free-tier topology

The code can be deployed as a static frontend, a persistent Node/Express
backend, and a transaction-capable MongoDB service. Potential providers
include static hosting such as Cloudflare Pages, Netlify, or Vercel; an
Express-compatible host such as Render; and MongoDB Atlas. Availability of
free tiers, geographic coverage, sleep behavior, quotas, and MongoDB
transaction eligibility vary and must be verified directly with each
provider.

Suggested deployment sequence:

1. Create a MongoDB deployment that supports transactions and allow network
   access from the selected backend host.
2. Deploy the backend as a Node service with install command
   `npm ci --prefix server` and start command `npm start --prefix server`.
3. Set backend secrets/configuration and confirm its `/api/health` endpoint.
4. Build the client with `VITE_API_URL` pointing to the backend API and
   `VITE_CURRENCY` set appropriately.
5. Publish `client/dist/` as a static SPA and configure history fallback to
   `index.html`.
6. Set backend `CLIENT_ORIGIN` to the exact deployed frontend origin.
7. Test sign-in, authorization, catalog, and transaction-dependent workflows
   against the deployed environment. Do not use synthetic seed data in
   production without explicit review.

This is a provider-neutral recommendation, not evidence that a deployment
exists or that a particular provider currently offers a suitable free plan.

## 11. Environment security

- Use provider-managed secret storage for `MONGODB_URI` and `JWT_SECRET`.
- Restrict database credentials and network allowlists to the application.
- Use separate development and production databases and credentials.
- Keep all `VITE_*` values non-secret; they are public in the built client.
- Do not log full connection URIs, access tokens, or passwords.
- Enable TLS on public frontend/API access and use secure host/domain
  configuration.
- Rotate credentials if exposed and update the hosting environment.
- Back up production data and verify restoration procedures; backups are not
  configured by this repository.
- Set CORS to the exact frontend origin and monitor API/provider logs.
- Run admin creation only in a private terminal and never store the password
  in an issue, report, or source file.

## 12. Deployment troubleshooting

| Symptom | Checks |
| --- | --- |
| Server exits during startup | Confirm required `MONGODB_URI` and `JWT_SECRET`; check `PORT`, `CLIENT_ORIGIN`, and other values against `server/src/config/env.js` validation |
| Database connection fails | Check URI, URL-encoded credentials, Atlas database user, TLS, IP allowlist, and provider egress networking |
| Purchase/sale/return/adjustment fails with transaction error | Ensure the MongoDB deployment is a replica set or `mongos`; standalone deployments cannot run these transactions |
| Browser reports CORS failure | Make `CLIENT_ORIGIN` exactly match the deployed frontend origin and redeploy/restart the API |
| Frontend cannot reach backend | Set `VITE_API_URL` before building; verify the URL includes `/api` and the API health endpoint is reachable |
| SPA nested route returns host 404 | Configure the static provider to route client paths to `index.html` |
| Login fails after deployment | Check API URL, browser network response, user activation, account role, and server logs; do not share credentials when requesting help |
| Admin bootstrap refuses to proceed | The script requires an interactive TTY, valid name/email/password, and no existing admin account |
| Seed appears to have no effect | Seed uses existing keys without overwriting them; inspect the configured database and collection records before running it again |
| Host is slow or unavailable on free tier | Review provider sleep/quota/limits; this app has no configured health monitor or provider-specific uptime setup |

No public deployment URL, provider setup, CI/CD workflow, or production
credentials are included in this repository at the time this guide was
written.

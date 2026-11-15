# PharmaCare — Pharmacy Management System

PharmaCare is a full-stack pharmacy operations application built with React,
Express, and MongoDB. It brings a searchable medicine catalog, supplier
purchasing, batch-level inventory, point-of-sale workflows, returns, and
operational reporting into a role-aware web workspace.

The application is a project/demo system, not a medical reference or a
substitute for professional clinical, regulatory, accounting, or pharmacy
guidance. Seed catalog content and prices are illustrative.

> **Project status:** Local development and test workflows are implemented.
> Production hosting and deployment automation are not configured in this
> repository.

## Table of contents

- [Problem statement](#problem-statement)
- [Objectives](#objectives)
- [Implemented features](#implemented-features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Database overview](#database-overview)
- [Authentication and roles](#authentication-and-roles)
- [Prerequisites](#prerequisites)
- [Clone and install](#clone-and-install)
- [Configure MongoDB Atlas](#configure-mongodb-atlas)
- [Environment variables](#environment-variables)
- [Run the application](#run-the-application)
- [Create the first administrator](#create-the-first-administrator)
- [API documentation](#api-documentation)
- [Seed data](#seed-data)
- [Testing and quality checks](#testing-and-quality-checks)
- [Screenshots](#screenshots)
- [Demo credentials](#demo-credentials)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [AI tools and attribution](#ai-tools-and-attribution)
- [Author and project information](#author-and-project-information)

## Problem statement

Pharmacy operations involve more than maintaining a product list. Stock is
received in supplier batches with distinct quantities and expiry dates, then
changes through purchases, sales, returns, and adjustments. A single stock
number on a medicine record cannot reliably represent those events or support
expiry-aware allocation and traceability.

PharmaCare models stock at the batch level and records operational changes
through purchase, sale, return, movement, and audit records. It provides
role-specific interfaces for common catalog and pharmacy workflows, while
enforcing authorization and business rules in the API.

## Objectives

- Provide a searchable catalog of medicines, categories, and suppliers.
- Keep stock quantities attached to traceable supplier batches and expiry
  dates.
- Receive purchases, process sales, and allocate eligible stock by FEFO
  (First Expiry, First Out).
- Record stock adjustments, returns, and stock movement history.
- Provide role-appropriate dashboards, reporting, and user administration.
- Validate inputs and enforce access on the backend, not only in the UI.

## Implemented features

- **Authentication and accounts:** customer registration, email/password login,
  JWT access tokens, authenticated profile, logout/session revocation, and
  admin-managed roles and account activation.
- **Medicine catalog:** medicine and category create, read, update, and
  deletion (deletion is prevented when records are referenced); search by
  partial medicine or generic name; filtering, sorting, and pagination.
- **Catalog prices:** available selling price is derived from the earliest
  eligible batch. Customer catalog responses omit internal reorder and
  purchase-cost fields.
- **Suppliers:** create, view, update, activate/deactivate, filter/search, and
  browse supplier purchase history.
- **Purchasing:** receive purchases into new batches; calculate purchase
  amounts on the server and record inventory movements.
- **Batch inventory:** view batch quantities and prices, available/low stock,
  stock valuation, expired and near-expiry batches, and record reasoned stock
  adjustments.
- **Point of sale:** search medicines, check sellable quantities, process
  sales, allocate stock using FEFO, and generate printable invoices.
- **Returns:** record returns against original sale items. Returned quantities
  remain pending inspection and are not automatically returned to sellable
  stock.
- **Dashboard and reports:** operational dashboard with sales and stock
  metrics, alerts, and recent sales; sales, stock, expiry, supplier, movement,
  and (admin-only) audit reporting.
- **Operational safeguards:** server-side Zod and Mongoose validation,
  transaction-backed write workflows, conditional inventory updates to guard
  against overselling, append-only stock movement and audit records, login and
  registration rate limiting, Helmet headers, and configured CORS.
- **Seed catalog:** 100 illustrative medicines with general-use descriptions
  and priced starter batches, in addition to the script’s sample records.
  These records are demo data, not medical advice.

There is no integrated payment gateway. The sale workflow records a selected
payment method; it does not charge a payment instrument.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Axios, Recharts, Lucide React, Tailwind CSS Vite plugin |
| Backend | Node.js (ES modules), Express 5, Mongoose 9 |
| Database | MongoDB |
| Authentication and validation | JSON Web Token, bcryptjs, Zod |
| HTTP middleware and API docs | Helmet, CORS, express-rate-limit, Morgan, Swagger UI / OpenAPI |
| Tests and quality | Node.js test runner, Jest, Supertest, ESLint, Vite production build |

Dependency versions are declared in [`client/package.json`](./client/package.json)
and [`server/package.json`](./server/package.json). Lockfiles are committed
for both applications.

## Architecture

```text
React UI (pages, role-aware routes, feature API clients)
                         │
                         │ Axios / JSON / Bearer token
                         ▼
Express routes → authentication → role/permission checks → Zod validation
                         │
                         ▼
Controllers → domain services → Mongoose models → MongoDB
                         │
                         └─ Transactions for purchases, sales,
                            returns, and stock adjustments
```

The frontend is in `client/`; it contains the role-aware workspace, pages,
shared styles, and small feature API clients. The backend is in `server/`;
routes compose middleware and validators, controllers adapt HTTP requests,
services implement the business rules, and Mongoose models define persisted
records and indexes.

The UI hides pages and actions a role cannot use, but that is only a usability
measure. The API independently authenticates protected requests and enforces
roles and permissions.

### Main frontend routes

| Path | Page |
| --- | --- |
| `/login`, `/register` | Sign in and customer registration |
| `/` | Role-aware dashboard |
| `/medicines` | Medicine catalog and search |
| `/categories`, `/suppliers`, `/purchases` | Catalog and procurement management |
| `/inventory`, `/sales`, `/returns`, `/movements`, `/reports` | Pharmacy operations |
| `/users` | Admin user and role management |
| `/profile` | Signed-in account details |

Access to workspace paths depends on the signed-in role.

## Repository structure

```text
PharmaCare/
├── .gitignore
├── README.md
├── client/
│   ├── .env.example
│   ├── .gitignore
│   ├── README.md
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── Workspace.css
│       ├── index.css
│       ├── main.jsx
│       ├── assets/
│       │   ├── hero.png
│       │   ├── react.svg
│       │   └── vite.svg
│       ├── components/
│       │   └── ProtectedRoute.jsx
│       ├── features/
│       │   ├── auth/
│       │   │   ├── api.js
│       │   │   └── AuthProvider.jsx
│       │   ├── catalog/
│       │   │   └── api.js
│       │   └── operations/
│       │       └── api.js
│       ├── lib/
│       │   └── api.js
│       └── pages/
│           ├── LoginPage.jsx
│           ├── SalesTrendChart.jsx
│           ├── WorkspacePages.jsx
│           └── pageMeta.js
├── docs/
│   ├── AI-ATTRIBUTION.md
│   ├── API-DOCUMENTATION.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT-GUIDE.md
│   ├── ER-DIAGRAM.md
│   ├── SUBMISSION-CHECKLIST.md
│   ├── TECHNICAL-REPORT.md
│   ├── TEST-REPORT.md
│   └── USER-GUIDE.md
└── server/
    ├── .env.example
    ├── jest.config.js
    ├── package.json
    ├── package-lock.json
    ├── src/
    │   ├── app.js
    │   ├── server.js
    │   ├── auth/
    │   │   └── roles.js
    │   ├── config/
    │   │   ├── database.js
    │   │   ├── env.js
    │   │   └── openapi.js
    │   ├── controllers/
    │   │   ├── authController.js
    │   │   ├── batchController.js
    │   │   ├── categoryController.js
    │   │   ├── inventoryController.js
    │   │   ├── medicineController.js
    │   │   ├── purchaseController.js
    │   │   ├── reportController.js
    │   │   ├── returnController.js
    │   │   ├── saleController.js
    │   │   └── supplierController.js
    │   ├── middleware/
    │   │   ├── authRateLimit.js
    │   │   ├── authenticate.js
    │   │   ├── authorize.js
    │   │   ├── errorHandler.js
    │   │   ├── notFound.js
    │   │   └── validateRequest.js
    │   ├── models/
    │   │   ├── appendOnly.js
    │   │   ├── AuditLog.js
    │   │   ├── Batch.js
    │   │   ├── Category.js
    │   │   ├── index.js
    │   │   ├── Medicine.js
    │   │   ├── Purchase.js
    │   │   ├── Return.js
    │   │   ├── Sale.js
    │   │   ├── StockMovement.js
    │   │   ├── Supplier.js
    │   │   └── User.js
    │   ├── routes/
    │   │   ├── authRoutes.js
    │   │   ├── batchRoutes.js
    │   │   ├── categoryRoutes.js
    │   │   ├── inventoryRoutes.js
    │   │   ├── medicineRoutes.js
    │   │   ├── purchaseRoutes.js
    │   │   ├── reportRoutes.js
    │   │   ├── returnRoutes.js
    │   │   ├── saleRoutes.js
    │   │   └── supplierRoutes.js
    │   ├── scripts/
    │   │   ├── createAdmin.js
    │   │   ├── medicineCatalog.js
    │   │   └── seed.js
    │   ├── services/
    │   │   ├── authService.js
    │   │   ├── batchService.js
    │   │   ├── categoryService.js
    │   │   ├── inventoryService.js
    │   │   ├── medicineService.js
    │   │   ├── purchaseService.js
    │   │   ├── reportService.js
    │   │   ├── returnService.js
    │   │   ├── saleService.js
    │   │   ├── stockAdjustmentService.js
    │   │   └── supplierService.js
    │   └── validators/
    │       ├── authValidators.js
    │       ├── catalogValidators.js
    │       ├── inventoryValidators.js
    │       ├── purchaseValidators.js
    │       ├── reportValidators.js
    │       ├── returnValidators.js
    │       ├── saleValidators.js
    │       └── supplierValidators.js
    └── test/
        ├── api.test.js
        ├── auth.test.js
        ├── catalog.test.js
        ├── inventory.test.js
        ├── models.test.js
        ├── purchase.test.js
        ├── reports.test.js
        ├── returns-adjustments.test.js
        ├── sales.test.js
        ├── supplier.test.js
        └── jest/
            └── auth.integration.test.js
```

Generated directories such as `node_modules/`, `dist/`, and `coverage/`, local
environment files, and editor files are not part of the tracked source tree.

## Database overview

MongoDB stores the following Mongoose models:

| Collection/model | Purpose |
| --- | --- |
| `User` | Account identity, password hash, role, activation, and session version |
| `Category` | Medicine categories |
| `Medicine` | Catalog details, category reference, and reorder threshold |
| `Supplier` | Supplier contact and activation details |
| `Batch` | Medicine/supplier references, quantity, buy/sell prices, and expiry |
| `Purchase` | Supplier purchase with embedded item snapshots |
| `Sale` | Completed sale, cashier, totals, payment method, and embedded item snapshots |
| `Return` | Return record linked to an original sale; initially pending inspection |
| `StockMovement` | Append-only signed stock changes and before/after quantities |
| `AuditLog` | Append-only record of audited operations |

Medicine documents do **not** contain an independently editable stock
quantity. Current stock is derived from batches. Eligible sale batches must
belong to an active medicine, have positive quantity, and not be expired. The
sale allocator consumes them in FEFO order. Sale and purchase items retain
historical names, batch numbers, quantities, and prices so later catalog
changes do not rewrite transaction history.

Purchases, sales, returns, and stock adjustments use MongoDB transactions for
related writes. **Use a replica-set or `mongos` connection** for these
workflows; a standalone MongoDB server does not support the required
transactions.

## Authentication and role-based access

- Passwords are hashed using bcryptjs. Login returns a signed JWT access
  token; protected client requests send it as a bearer token.
- Logout increments a session version so existing tokens are revoked.
- Login and registration have an in-memory rate limit of 10 attempts per
  15-minute window per server process.
- Public registration always creates a `customer`; the request cannot choose a
  staff role.
- The first `admin` is provisioned privately using the
  [create-admin command](#create-the-first-administrator). Admins can manage
  accounts and assign roles in the Users page.
- Route permissions are enforced by the API in addition to the client’s
  role-aware navigation.

| Role | Implemented access summary |
| --- | --- |
| `admin` | All API permissions; dashboard, catalog, suppliers, purchases, inventory, sales, returns, movements, reports, and user management |
| `pharmacist` | Catalog and supplier management, purchases, inventory and stock adjustments, sales, returns, movements, dashboard, and permitted reports |
| `cashier` | Medicine search, inventory reads, sales and invoice operations, and permitted sales reports |
| `customer` | Medicine catalog and profile; public registration creates this role |

For the authoritative permission checks and endpoints, see
[`server/src/auth/roles.js`](./server/src/auth/roles.js) and
[`server/src/routes/`](./server/src/routes/).

## Prerequisites

- Node.js **20.19+** or **22.12+** (or a compatible current Node release for
  the installed Vite version).
- npm.
- MongoDB local instance or MongoDB Atlas cluster.
- A MongoDB replica set or `mongos` for transactional purchasing, sales,
  returns, and adjustments.
- Git to clone the repository.

There is no root `package.json`; install and run the client and server using
their own package manifests.

## Clone and install

```sh
git clone https://github.com/sourodip19/PharmaCare-Pharmacy-Management-System.git
cd PharmaCare-Pharmacy-Management-System

cp server/.env.example server/.env
cp client/.env.example client/.env

npm install --prefix server
npm install --prefix client
```

Edit `server/.env` and set `MONGODB_URI` and a private, random `JWT_SECRET` of
at least 32 characters. Keep `.env` files private; they are excluded by the
repository ignore rules. The client `.env` may use its example values for
local development.

## Configure MongoDB Atlas

1. Create an Atlas project and cluster that supports replica-set transactions.
2. Create a database user with only the permissions needed by this application.
3. Configure Atlas Network Access to allow the development or deployment
   server to connect. Avoid opening database access broadly for production.
4. Copy the cluster connection string and replace the placeholders with the
   database username, URL-encoded password, and cluster host:

   ```text
   mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/pharmacare?retryWrites=true&w=majority
   ```

5. Put the complete URI in `server/.env` as `MONGODB_URI`. Do not put database
   credentials in client-side `VITE_*` variables, source files, screenshots,
   or commits.
6. Start the server and check `http://localhost:5001/api/health`. A connected
   database returns HTTP 200 with `{"status":"ok","database":"connected"}`.

Atlas interface labels may change. Follow the current Atlas instructions for
creating a database user, configuring network access, and obtaining a
connection string. Never send real credentials to a public issue or chat.

## Environment variables

### Backend (`server/.env`)

Copy [`server/.env.example`](./server/.env.example) to `server/.env`.
`MONGODB_URI` and `JWT_SECRET` are required.

| Variable | Required | Default / example | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Runtime environment: `development`, `test`, or `production` |
| `PORT` | No | `5001` | Port used by the API server |
| `MONGODB_URI` | **Yes** | Local example: `mongodb://127.0.0.1:27017/pharmacare` | MongoDB connection URI; use a replica-set-capable deployment for transaction workflows |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Browser origin allowed by CORS |
| `JWT_SECRET` | **Yes** | No real value supplied | Private JWT signing secret, at least 32 characters |
| `JWT_ACCESS_TOKEN_TTL` | No | `15m` | JWT lifetime; format is an integer followed by `s`, `m`, `h`, or `d` |
| `SALES_TAX_RATE` | No | `0` | Tax fraction from `0` to `1` |
| `MAX_SALE_DISCOUNT_PERCENT` | No | `20` | Maximum allowed sale discount percentage from `0` to `100` |
| `PHARMACY_NAME` | No | `PharmaCare Pharmacy` | Name printed on generated invoices |

### Frontend (`client/.env`)

Copy [`client/.env.example`](./client/.env.example) to `client/.env`.

| Variable | Required | Default / example | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | `http://localhost:5001/api` | API base URL used by the browser client |
| `VITE_CURRENCY` | No | `USD` | ISO 4217 currency code used to format displayed prices and totals |

Vite embeds `VITE_*` values into the browser build. Never place secrets,
database credentials, or signing keys in frontend environment variables.

## Run the application

Start the backend and frontend in separate terminals from the repository root.

**Terminal 1 — API server:**

```sh
npm run dev --prefix server
```

The API defaults to `http://localhost:5001`.

**Terminal 2 — Vite frontend:**

```sh
npm run dev --prefix client
```

Vite prints the local frontend URL (normally `http://localhost:5173`). Open
that address to register a customer or sign in. The backend readiness endpoint
is `http://localhost:5001/api/health`.

## Create the first administrator

There is no built-in admin account or demo password. Public registration
creates customer accounts only. After configuring the backend environment,
run this command from the repository root in a private interactive terminal:

```sh
npm run create-admin --prefix server
```

Enter the admin name and email, then enter a password when prompted (the
password is not echoed). The command only creates an admin if one does not
already exist and refuses an email already registered. Sign in at the regular
`/login` page with the credentials you entered. Do not expose this command as a
public API or commit the password.

## API documentation

The Express application serves its generated OpenAPI/Swagger documentation
when the backend is running:

- Swagger UI: [`http://localhost:5001/api/docs`](http://localhost:5001/api/docs)
- OpenAPI JSON: [`http://localhost:5001/api/docs.json`](http://localhost:5001/api/docs.json)

All API routes are mounted under `/api`. The implemented endpoint groups
include authentication and users, medicines, categories, suppliers, purchases,
batches, inventory, sales and invoices, returns, and reports. The OpenAPI
document and route files are the authoritative references for exact methods,
request schemas, and permissions.

The repository also includes a comprehensive route-by-route reference at
[`docs/API-DOCUMENTATION.md`](./docs/API-DOCUMENTATION.md), alongside the
[`architecture`](./docs/ARCHITECTURE.md), [`ER diagram`](./docs/ER-DIAGRAM.md),
[`user guide`](./docs/USER-GUIDE.md), and
[`test report`](./docs/TEST-REPORT.md).

## Seed data

With the backend environment configured and MongoDB running, seed the
development/sample catalog:

```sh
npm run seed --prefix server
```

The idempotent seed adds 10 categories, 100 illustrative catalog medicines,
sample medicines and suppliers, and priced starter batches. Existing matching
records are left unchanged. It does not create an administrator, sales, or
purchase transaction history. Seed medicine descriptions are general-use
examples and are not medical advice; demo prices should not be treated as
real-world pricing.

## Testing and quality checks

Run commands from the repository root:

```sh
# Backend Node test runner and Jest/Supertest suite
npm test --prefix server

# Backend coverage
npm run test:coverage --prefix server

# Frontend lint
npm run lint --prefix client

# Frontend production build
npm run build --prefix client

# Serve the built frontend locally for preview
npm run preview --prefix client
```

The Node tests cover services, validators, models, and mocked API behavior.
Jest/Supertest covers HTTP authentication/authorization and API documentation.
Many backend tests use mocks; validate real transaction behavior separately
against an isolated replica-set test database before a production release.

## Screenshots

> **TODO:** Add screenshots captured from a running instance with sample data.
> Do not include real customer information, passwords, tokens, or database
> details.

| Screen | Screenshot |
| --- | --- |
| Login | TODO — add `docs/screenshots/login.png` |
| Admin dashboard | TODO — add `docs/screenshots/admin-dashboard.png` |
| Medicine catalog and search | TODO — add `docs/screenshots/medicine-catalog.png` |
| Inventory and stock adjustment | TODO — add `docs/screenshots/inventory.png` |
| Sales and invoice | TODO — add `docs/screenshots/sales.png` |
| Reports | TODO — add `docs/screenshots/reports.png` |

## Demo credentials

No shared demo credentials are committed or preconfigured. Register a customer
through the app, or create the first administrator using the
[private setup command](#create-the-first-administrator).

| Account | Email | Password |
| --- | --- | --- |
| Admin | TODO — enter the email configured locally; do not commit it if private | Never store or publish a password here |
| Customer | TODO — register a local customer account | Never store or publish a password here |

## Deployment

No hosting provider configuration, deployment workflow, container definition,
or production URL is included in this repository. A production deployment is
therefore **not preconfigured or verified**.

The client has a production build command and local preview command:

```sh
npm run build --prefix client
npm run preview --prefix client
```

The backend has a start command:

```sh
npm start --prefix server
```

For a real deployment, the operator must choose and configure hosting for both
apps, provide the environment variables through a secrets manager, set
`VITE_API_URL` at client build time, set `CLIENT_ORIGIN` to the actual frontend
origin, configure HTTPS and CORS, use a protected MongoDB replica-set/Atlas
deployment, restrict database network access, and establish backups and
monitoring. **TODO:** Select hosting providers and document/verify provider-
specific deployment steps and a production URL before claiming deployment
support.

## Known limitations

- Sales identify the processing staff account but do not associate a customer
  account with an invoice; customer-specific purchase history is not
  implemented.
- Customer catalog price reflects the earliest eligible batch. A sale spanning
  multiple batches can use different batch prices.
- Payment methods are recorded for the sale; no payment gateway is connected.
- Returns remain pending inspection. An inspection/restock release workflow is
  not implemented.
- Seed stock is illustrative and does not create corresponding purchase
  transaction or stock-movement history.
- Authentication rate limiting is in memory and does not coordinate across
  multiple backend instances.
- Transaction-dependent operations require a MongoDB replica set or `mongos`.
- Production deployment, live credentials, backups, monitoring, and release
  operations remain to be configured and tested.
- Screenshots, public demo credentials, author metadata, and a production
  deployment URL are not included.

## AI tools and attribution

AI-assisted development and documentation support: GitHub Copilot (Copilot SDK
in VS Code). The project author/maintainer remains responsible for reviewing,
testing, and maintaining all generated or edited work.

**TODO:** Add any additional tools, collaborators, libraries, or sources that
require attribution under the project’s chosen submission/license policy.

## Author and project information

| Field | Information |
| --- | --- |
| Project | PharmaCare — Pharmacy Management System |
| Repository | [`sourodip19/PharmaCare-Pharmacy-Management-System`](https://github.com/sourodip19/PharmaCare-Pharmacy-Management-System) |
| Author | TODO — add preferred author name |
| Institution / course | TODO — add if relevant to the internship assessment |
| Project period | TODO — add dates |
| License | TODO — choose and add a repository `LICENSE` file; no root license file is currently present |

For design details and additional discussion, see
[`docs/TECHNICAL-REPORT.md`](./docs/TECHNICAL-REPORT.md).

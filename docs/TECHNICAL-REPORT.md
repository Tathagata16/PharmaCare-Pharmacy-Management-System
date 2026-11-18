# Technical Project Report

## PharmaCare — Pharmacy Management System

## 1. Cover Page

### Internship Project Report

| Cover-page field | Information |
| --- | --- |
| Project title | **PharmaCare — Pharmacy Management System** |
| Organization | **Algions AI Labs Private Limited** |
| Internship role | **Fullstack Web Developer** |
| Candidate name | **Tathagata Ghosh** |
| Registration number | **12301189** |
| Project repository | `Tathagata16/PharmaCare-Pharmacy-Management-System` |
| Report status | Technical report based on the implemented source code |

---

## 2. Abstract

PharmaCare is a web-based pharmacy operations system implemented with a React
and Vite frontend, an Express API, and MongoDB accessed through Mongoose. It
provides authenticated workflows for medicine and category catalog
management, supplier records, purchases, batch-level inventory, sales,
invoicing, returns, stock adjustments, and operational reports.

The central inventory design stores quantities in supplier-linked medicine
batches rather than on the medicine catalog document. Sales select active,
unexpired batches in First Expiry, First Out (FEFO) order. Purchase receipt,
sale processing, return recording, and stock adjustment use MongoDB
transactions for their related writes. Stock movements and audit records
provide an operational history for applicable changes.

The system has four roles—admin, pharmacist, cashier, and customer. The client
uses role-aware navigation, while the API independently authenticates users,
checks permissions, and validates request data. This report describes the
implemented code and its current operational constraints; it does not claim
production deployment or unverified performance results.

## 3. Introduction

Pharmacy operations require coordination of medicine catalog information,
supplier purchasing, batch quantities, expiry dates, sales, returns, and
accountability. A catalog entry alone does not represent the quantity and
expiry details of stock received through separate deliveries.

PharmaCare addresses these workflows through a MERN-style application:
React/Vite pages call authenticated Express endpoints; the API delegates
business logic to services; Mongoose models persist domain records in
MongoDB. Staff roles receive differing application and API permissions.

The software is an operational project/demo system. Seed descriptions and
prices are illustrative and are not medical advice or a source of clinical
guidance.

## 4. Problem Statement

Tracking stock only as a total quantity per medicine obscures the supplier
batch that supplied each unit, its purchase and selling prices, and its expiry
date. This makes expiry-aware sales, stock reconciliation, and investigation
of stock changes difficult. Operational applications also need to prevent
unauthorized staff actions and avoid partially persisted transactions when a
workflow updates multiple records.

PharmaCare models stock per batch and records purchase, sale, and adjustment
changes as stock movements. It uses server-side validation and role
authorization, with transaction-backed services for coupled writes.

## 5. Project Objectives

1. Provide a searchable, filterable, and paginated medicine catalog.
2. Maintain categories, supplier details, and medicine activation status.
3. Represent received inventory as identifiable medicine/supplier batches
   with quantities, prices, and expiry dates.
4. Receive supplier purchases and process sales using backend-calculated
   totals and eligible inventory.
5. Allocate sellable stock in FEFO order and guard against concurrent
   overselling.
6. Record reasoned stock adjustments, returns, stock movements, and audit
   events where implemented.
7. Provide role-specific pages, dashboards, and reports.
8. Enforce authentication, permissions, and request validation at the API
   boundary.

## 6. Scope of the Project

### Included

- Customer registration, login, logout, profile, and administrator-managed
  user roles and activation.
- Medicine, category, and supplier operations.
- Supplier purchases received as traceable batches.
- Batch-level stock reads, low-stock and expiry alerts, valuation, and stock
  adjustment.
- Point-of-sale processing, FEFO allocation, invoice details, and printable
  invoice output.
- Returns recorded against completed sale items, with returned goods held in
  a pending-inspection state.
- Dashboard metrics and sales, stock, expiry, supplier, movement, and
  admin-only audit reports.
- OpenAPI documentation and backend/frontend test and build commands.

### Not included

- A payment gateway or actual payment authorization.
- Customer-linked sale history or customer invoice browsing.
- A return inspection workflow that releases stock back into sellable
  inventory.
- A configured production hosting environment or deployment pipeline.
- Automated medical advice, prescription validation, or regulatory
  verification of catalog descriptions.

## 7. Technology Stack

| Layer | Implemented technologies |
| --- | --- |
| Frontend | React 19, React Router, Vite 8, Axios, Recharts, Lucide React, Tailwind CSS Vite plugin |
| Backend | Node.js ES modules, Express 5 |
| Persistence | MongoDB and Mongoose 9 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), password hashing (`bcryptjs`) |
| Validation | Zod request schemas and Mongoose model validation |
| HTTP middleware | Helmet, CORS, `express-rate-limit`, Morgan |
| API reference | OpenAPI 3.0.3 definition and Swagger UI |
| Tests | Node.js built-in test runner, Jest, Supertest |
| Frontend quality checks | ESLint and Vite production build |

Versions and commands are declared in `client/package.json` and
`server/package.json`; the repository has no root `package.json`.

## 8. System Requirements

### Software requirements

- Node.js 20.19+ or 22.12+ as documented by the project; the installed Vite
  release requires a compatible current Node.js runtime.
- npm and Git.
- MongoDB local server or MongoDB Atlas.
- A replica-set or `mongos` MongoDB deployment for transaction-dependent
  purchase, sale, return, and adjustment workflows.
- A modern browser for the React/Vite client.

### Environment requirements

The backend requires `MONGODB_URI` and a private `JWT_SECRET` of at least 32
characters. `CLIENT_ORIGIN` should match the frontend origin in the
environment. Optional backend and frontend configuration is described in the
root `README.md` and the checked-in `.env.example` files.

No hardware benchmark or minimum CPU/memory figure is specified by the
project; deployment sizing must be measured for the chosen workload and
hosting environment.

## 9. System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ React + Vite client                                          │
│ Login/register · role-aware workspace · pages · API clients  │
└──────────────────────────────┬───────────────────────────────┘
                               │ Axios, JSON, bearer JWT
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Express API                                                  │
│ Routes → authentication → authorization → Zod validation     │
│ Controllers → domain services                                │
└──────────────────────────────┬───────────────────────────────┘
                               │ Mongoose
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ MongoDB                                                       │
│ Users · catalog · suppliers · batches · transactions         │
│ stock movements · audit logs                                 │
└──────────────────────────────────────────────────────────────┘
```

### Frontend

The React application starts in `client/src/main.jsx`. `App.jsx` configures
the browser routes, authentication provider, protected workspace, and
role-specific navigation. `WorkspacePages.jsx` implements the dashboard,
catalog, procurement, inventory, sales, returns, reporting, and user
management pages. Feature API clients are grouped under
`client/src/features/`; Axios configuration and API error formatting are in
`client/src/lib/api.js`.

### Backend

`server/src/server.js` loads configuration, connects to MongoDB, and starts
the HTTP listener. `server/src/app.js` configures middleware, mounts route
groups, and serves health and OpenAPI endpoints. Each route combines
authentication, permission checks, and request validation as appropriate.
Controllers adapt HTTP input/output; services implement business rules and
persistence operations; models define schemas, constraints, and indexes.

### API groups

The actual route modules are `authRoutes`, `medicineRoutes`,
`categoryRoutes`, `supplierRoutes`, `purchaseRoutes`, `batchRoutes`,
`inventoryRoutes`, `saleRoutes`, `returnRoutes`, and `reportRoutes`.
Mounted under `/api`, their implemented endpoint groups include:

| API group | Implemented endpoint paths |
| --- | --- |
| Health and documentation | `GET /api/health`, `GET /api/docs`, `GET /api/docs.json` |
| Authentication/users | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/users`, `PATCH /api/auth/users/:userId/role`, `PATCH /api/auth/users/:userId/activation` |
| Medicines | `GET/POST /api/medicines`, `GET/PATCH/DELETE /api/medicines/:medicineId` |
| Categories | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:categoryId` |
| Suppliers | `GET/POST /api/suppliers`, `GET/PATCH /api/suppliers/:supplierId`, `PATCH /api/suppliers/:supplierId/activation`, `GET /api/suppliers/:supplierId/purchases` |
| Purchases/batches | `GET/POST /api/purchases`, `GET /api/purchases/:purchaseId`, `GET /api/batches` |
| Inventory | `GET /api/inventory/available/:medicineId`, `GET /api/inventory/batch-wise/:medicineId`, `GET /api/inventory/low-stock`, `GET /api/inventory/near-expiry`, `GET /api/inventory/expired`, `GET /api/inventory/valuation`, `POST /api/inventory/adjustments` |
| Sales/invoices | `GET/POST /api/sales`, `GET /api/sales/:saleId`, `GET /api/sales/:saleId/invoice`, `GET /api/sales/:saleId/invoice/print` |
| Returns | `GET/POST /api/returns` |
| Reports | `GET /api/reports/dashboard`, `/sales`, `/stock`, `/expiry`, `/suppliers`, `/stock-movements`, and `/audit` |

The generated OpenAPI definition at `/api/docs.json` is the authoritative
reference for methods, schemas, and route permissions.

## 10. Database Design

MongoDB documents are defined by the following Mongoose models:

| Model | Main fields and relationships |
| --- | --- |
| `User` | Name, unique email, bcrypt password hash, role, activation state, and session version |
| `Category` | Unique category name and description |
| `Medicine` | Name, generic name, brand, category reference, manufacturer, description, reorder level, and active state |
| `Supplier` | Contact details and active state |
| `Batch` | Medicine and supplier references, batch number, quantity, purchase price, selling price, expiry date, and received date |
| `Purchase` | Supplier, invoice number, embedded item snapshots, total, processor, and date |
| `Sale` | Invoice number, embedded item snapshots, totals, payment method, cashier, status, and idempotency metadata |
| `Return` | Original sale reference, invoice, processor, reason, embedded return items, refund total, and inspection status |
| `StockMovement` | Medicine/batch references, movement type, signed quantity change, previous/new quantities, reason, actor, and timestamp |
| `AuditLog` | Actor, action, entity type/ID, details, and timestamp |

### Relationships and stock representation

- One `Category` can classify many `Medicine` records.
- One `Medicine` can have many `Batch` records.
- One `Supplier` can supply many batches and purchases.
- Purchases and sales embed item snapshots and retain references to relevant
  medicine, batch, supplier, and user records.
- A `Return` references its original `Sale`.
- Stock movements reference the affected medicine and batch. Audit entries
  reference the relevant domain entity.

Medicine records do not store an editable stock count. The current quantity is
the sum of batch quantities; sellable availability further excludes expired
batches and inactive medicines. The model layer uses indexes for unique user
email, category name, medicine/batch identity, invoice numbers, idempotency
keys, and common reference/time lookups.

## 11. Module Description

### 11.1 User Authentication

The `User` model stores a bcrypt hash and supports `admin`, `pharmacist`,
`cashier`, and `customer` roles. Public `POST /api/auth/register` always
creates a customer. `POST /api/auth/login` verifies credentials and returns a
signed JWT. Protected routes use `authenticate` middleware to verify the
token and check the current account and session version. `POST
/api/auth/logout` increments the session version to revoke existing tokens.

The first administrator is provisioned by the private CLI script
`server/src/scripts/createAdmin.js`; the script is not a public HTTP route.
Admins can list users and update roles or activation through the
`/api/auth/users` endpoints.

### 11.2 Medicine Management

`Medicine` stores catalog information and a reference to `Category`.
`medicineRoutes` expose listing/search, item lookup, creation, patching, and
deletion. `medicineService.listMedicines` supports case-insensitive partial
search against name and generic name, as well as category/manufacturer
filters, pagination, and sorting. Medicine deletion is blocked while batches,
sales, or purchases reference the record.

Catalog price is not stored on `Medicine`; the API obtains the earliest
eligible batch selling price. Customer responses omit internal reorder and
purchase-cost data.

### 11.3 Category Management

`Category` stores a unique name and optional description. Authenticated
medicine readers can list categories. Users with `medicine:manage`
permission can create, update, and delete them. Deletion is rejected if a
medicine still references the category.

### 11.4 Supplier Management

`Supplier` contains name, contact person, email, phone, address, and active
state. The supplier API supports list/search/filter, create, detail lookup,
update, activation changes, and paginated purchase history. The implemented
routes do not expose supplier deletion.

### 11.5 Purchase Management

Authorized admin and pharmacist users can submit `POST /api/purchases` with a
supplier and one or more medicine/batch purchase lines. The service verifies
active suppliers and medicines, creates received batches, calculates line and
invoice totals from purchase price and quantity, creates a `Purchase` record,
records purchase `StockMovement` entries, and records an `AuditLog` entry.
These writes occur in a MongoDB transaction. Purchase list and detail
endpoints expose persisted purchase records.

### 11.6 Batch Inventory

`Batch` is the source of stock quantity. Each batch associates one medicine
and supplier with a batch number, quantity, purchase and selling prices, and
expiry/received dates. Inventory routes provide available stock, batch-wise
stock, low-stock medicines, near-expiry/expired batches, and valuation.
Authorized users can list batches and record a reasoned stock adjustment.

### 11.7 Sales and Invoicing

The sales workflow accepts medicine IDs and integer quantities, a payment
method, a discount, and an idempotency key. The server checks availability,
allocates batches, and uses each allocated batch's selling price to calculate
line totals, subtotal, allowed discount, configured tax, and invoice total.
The `Sale`, batch decrements, stock movements, and audit record are written
within a transaction.

The API exposes sale listing/detail, invoice data, and an HTML invoice for
printing. No external payment gateway is connected. Cashiers' sale listing
is restricted to their own sales.

### 11.8 FEFO Inventory Management

`allocateStockFEFO` selects batches for the requested active medicine where
quantity is positive and expiry date is later than the current time. It sorts
by expiry date ascending, then by batch ID for deterministic ordering. It
decrements the earliest-expiring batch first, continuing into later batches
if needed. Conditional quantity updates and a transaction prevent a sale from
committing against stale or insufficient stock.

**Example:** A sale requests 7 units. Eligible batch A expires first and has 4
units; batch B expires later and has 5 units. FEFO takes 4 from A and 3 from B.
Expired batches are excluded. If eligible stock totals less than 7, the sale
is rejected rather than partially completed.

### 11.9 Returns and Adjustments

Returns are tied to completed sale invoices and their original batch line
items. The service checks that the requested return does not exceed the
unreturned sold quantity, updates the sale item's returned quantity, and
creates a `Return` and audit entry in a transaction. The created return has
`pending_inspection` status. It does not increase batch stock or create a
stock movement; there is no implemented inspection/release flow.

Stock adjustments accept a batch, an adjustment type, a signed integer
quantity change, and a reason. The service checks the batch and resulting
quantity, applies the change conditionally in a transaction, and records a
stock movement and audit event. Damaged, expired, and missing adjustment
types must reduce quantity; an expired adjustment additionally requires the
batch to be expired. The UI interprets the entered quantity for those
reduction types as a positive count to subtract.

### 11.10 Reports and Dashboard

`GET /api/reports/dashboard` aggregates active medicine and supplier counts,
eligible units, daily/monthly/lifetime sales totals, low-stock medicines,
expired and near-expiry batches, and recent completed sales. The frontend
renders KPI cards, a sales trend chart, alerts, and recent invoices for
admin/pharmacist users.

The report services implement:

- Daily, weekly, or monthly sales aggregations with optional date filters.
- Stock movement-based opening/closing and movement-type summaries, plus
  current stock valuation and reconciliation difference.
- Expired and 30/60/90-day expiry groups.
- Supplier purchase counts and spend summaries.
- Paginated stock movement history.
- Admin-only append-only audit history.

The reports use persisted records; the dashboard does not use hard-coded sales
figures.

## 12. Business Logic

### Stock availability

Sellable quantity is derived from positive quantities in unexpired batches of
an active medicine. The medicine schema has no independently editable stock
field. Batch listings and inventory calculations apply the relevant expiry,
quantity, and active-medicine conditions.

### Purchase amount calculation

For each purchase line, the server calculates `quantity × purchasePrice`,
rounds monetary values to two decimal places, and sums the resulting line
totals. The client-supplied invoice total is not trusted.

### Sale amount calculation

For each FEFO batch allocation, the service uses that batch's selling price.
It computes line totals and subtotal, enforces the configured maximum
discount percentage, calculates tax from the configured `SALES_TAX_RATE`,
and persists the resulting totals. The sale request is hashed with its
idempotency key: a matching retry replays the prior sale, while reuse of the
key for a different request is rejected.

### Concurrency and transactions

Sale allocation uses conditional batch decrements and runs in a MongoDB
transaction. Purchase receipt, sale, return, and stock adjustment operations
also use transactions to keep their related database writes consistent. A
MongoDB replica set or `mongos` is required. The source tests include mocked
service behavior; those tests do not replace integration testing against a
real transaction-capable MongoDB deployment.

### Stock movement and audit recording

`StockMovement` is append-only and records medicine, batch, movement type,
signed quantity delta, previous quantity, new quantity, reason, actor, and
timestamp. Purchase, sale, and adjustment services create corresponding
movements inside their write transactions. `AuditLog` stores the actor,
action, entity reference, details, and timestamp, and is also append-only.
Return processing writes an audit record but does not change stock and
therefore does not create a stock movement.

Seeded opening quantities do not create purchase, movement, or audit history.
As a result, reports may show a reconciliation difference between current
batch stock and the sum of persisted lifetime movement entries for seeded
records.

## 13. Security Implementation

- Passwords are hashed with bcryptjs; password hashes and session versions
  are excluded from ordinary model selection.
- JWTs are signature/expiry checked and tied to a user's session version.
- Deactivated users and revoked sessions are rejected by authentication
  middleware.
- Public registration cannot assign a privileged role.
- Role and permission middleware enforces access server-side.
- Zod request schemas reject malformed or unexpected input; Mongoose applies
  schema constraints to persisted documents.
- Authentication endpoints use a per-process in-memory rate limiter.
- Helmet sets HTTP security headers, CORS is origin-configured, and JSON
  request bodies are limited to 10 KB.
- Database credentials and JWT secrets are expected in ignored backend
  environment files or a deployment secrets manager; they must not be exposed
  to the browser.
- Transactional updates and conditional quantity constraints protect
  inventory consistency.

This list describes implemented controls and is not a claim of security
certification or a substitute for deployment-specific review.

## 14. Testing Methodology

The backend test suite is split between Node's built-in test runner and
Jest/Supertest:

- `server/test/api.test.js`: API health, routing, CORS, authentication
  requirements, role denial, and request validation.
- `server/test/auth.test.js` and `server/test/jest/auth.integration.test.js`:
  authentication and HTTP integration behaviors.
- `server/test/catalog.test.js`: catalog validators, search, price selection,
  and deletion constraints.
- `server/test/inventory.test.js` and `server/test/returns-adjustments.test.js`:
  stock calculations, FEFO-related inventory behavior, adjustment rules, and
  return constraints.
- `server/test/purchase.test.js` and `server/test/sales.test.js`: purchase and
  sale transaction/service behavior, including inventory protections.
- `server/test/reports.test.js`, `server/test/models.test.js`, and
  `server/test/supplier.test.js`: report calculations, model constraints, and
  supplier workflows.

Many Node tests replace Mongoose methods with mocks, allowing service and
validation behavior to be exercised without a live database. Jest/Supertest
tests run an HTTP application and mock authentication/database lookups.
Real MongoDB transaction semantics, replica-set behavior, indexes, and
concurrent writes still require a separately configured integration
environment.

### Reproducible verification commands

Run from the repository root:

```sh
npm test --prefix server
npm run test:coverage --prefix server
npm run lint --prefix client
npm run build --prefix client
```

No performance measurements are reported. Test results should be generated
from the submission's current environment rather than copied from an earlier
run.

## 15. Results and Screenshots

The implemented result is a role-aware web application with working
catalog/search, purchasing, batch inventory, sales/invoices, return and
adjustment recording, and report modules, backed by authenticated and
validated APIs. Seed data can populate an illustrative catalog and batch
inventory. It does not generate sample transaction history or preconfigured
administrator credentials.

Screenshots are not currently included in this repository. Add verified
screenshots from a running instance before submission; redact user
information, credentials, tokens, and database details.

| Figure | Screenshot |
| --- | --- |
| 1. Login and registration | **TODO:** Add `docs/screenshots/login.png` |
| 2. Admin/pharmacist dashboard | **TODO:** Add `docs/screenshots/dashboard.png` |
| 3. Medicine search and catalog | **TODO:** Add `docs/screenshots/medicines.png` |
| 4. Batch inventory and stock adjustment | **TODO:** Add `docs/screenshots/inventory.png` |
| 5. Point of sale and invoice | **TODO:** Add `docs/screenshots/sales-invoice.png` |
| 6. Reports | **TODO:** Add `docs/screenshots/reports.png` |

## 16. Limitations

1. No payment gateway is integrated; payment method is recorded but not
   charged.
2. Sales are associated with the processing staff account, not a customer
   account. Customer-specific purchase history and invoice browsing are not
   implemented.
3. Return records remain pending inspection. A dedicated inspection,
   disposition, and stock-release workflow is not implemented.
4. Catalog price is based on the earliest eligible batch; a sale spanning
   batches may use more than one price.
5. Seed quantities are not accompanied by opening stock movement records, so
   movement reconciliation is not complete for seeded opening inventory.
6. The authentication rate limiter is process-local and is not shared across
   multiple server instances.
7. Transaction workflows require a replica set or `mongos`.
8. Production hosting, deployment automation, backups, monitoring, and
   live-provider settings are not included in the repository.
9. Screenshots, candidate details, registration number, and demo credentials
   are intentionally placeholders or absent.

## 17. Future Enhancements

The following are proposed improvements, not features claimed as implemented:

- Add a controlled return inspection workflow with authorized disposition
  and, when appropriate, audited restocking.
- Associate sales with optional customer accounts and provide suitable
  customer purchase/invoice history.
- Integrate a payment provider using provider-approved security and
  reconciliation practices.
- Add production-grade distributed rate limiting, structured monitoring,
  alerting, and backup/restore procedures.
- Add replica-set integration tests for transaction rollback, indexes, and
  concurrent purchase/sale/adjustment scenarios.
- Add deployment automation and document supported hosting environments.
- Add configurable locale, pharmacy-specific catalog data, and audited
  production pricing instead of illustrative seed records.
- Capture redacted screenshots and complete candidate/institution/license
  metadata for the internship submission.

## 18. Conclusion

PharmaCare implements a full-stack foundation for common pharmacy operations.
Its core design decision is to represent inventory through supplier-linked
batches with expiry dates and prices, rather than a single mutable medicine
stock field. FEFO allocation, transaction-backed operations, conditional
updates, role authorization, validation, stock movements, and audit records
provide traceability and consistency mechanisms within the implemented
workflows.

The application is suitable for technical demonstration and further
development. Before production use, it requires a transaction-capable
MongoDB deployment, environment-specific security configuration, operational
testing, deployment and backup procedures, and completion of the documented
business workflow limitations.

## 19. References and AI Attribution

### Project references

- PharmaCare source repository:
  `https://github.com/sourodip19/PharmaCare-Pharmacy-Management-System`
- API implementation and OpenAPI definition:
  `server/src/routes/`, `server/src/config/openapi.js`
- Domain schemas:
  `server/src/models/`
- Authentication roles and permissions:
  `server/src/auth/roles.js`
- Project setup and environment configuration:
  [`../README.md`](../README.md), `server/.env.example`,
  `client/.env.example`

### Technology references

- React: <https://react.dev/>
- Vite: <https://vite.dev/>
- Express: <https://expressjs.com/>
- MongoDB: <https://www.mongodb.com/docs/>
- Mongoose: <https://mongoosejs.com/docs/>
- Node.js: <https://nodejs.org/docs/>
- OpenAPI Specification: <https://spec.openapis.org/oas/v3.0.3>

### AI attribution

GitHub Copilot, accessed as an AI assistant using Copilot SDK in VS Code, was
used to assist with software engineering and technical documentation. The
candidate/project maintainer is responsible for reviewing the source,
validating the report against the implementation, and ensuring compliance
with the organization’s internship and attribution policies.

**Candidate-specific references and acknowledgements:** [PLACEHOLDER — add
any additional sources, tools, or collaborators required by the submission
policy.]

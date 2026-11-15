# PharmaCare API server

The Express/Mongoose API implements authentication, role-based authorization,
catalog and supplier management, purchases, batch inventory, FEFO sales,
returns, stock adjustments, reporting, and OpenAPI documentation.

## Setup

From the repository root, copy `server/.env.example` to `server/.env`, set a
private `JWT_SECRET` of at least 32 characters, and configure `MONGODB_URI`.
Transactional purchase, sale, return, and adjustment routes require a MongoDB
replica set or `mongos`.

```sh
npm install --prefix server
npm run dev --prefix server
```

The API defaults to `http://localhost:5001`. Readiness is available at
`/api/health`; Swagger UI and OpenAPI JSON are served at `/api/docs` and
`/api/docs.json`.

The idempotent development seed adds 100 sample medicines with use
descriptions, selling-price batches, and starter stock. Prices are illustrative;
catalog descriptions are not medical advice.

To create the first administrator, run `npm run create-admin` from a private
terminal in the server directory. It prompts for the account details, hides the
password while typing, and refuses to create an additional admin. Sign in with
that account through the normal client login page; public registration remains
customer-only.

## Security and business rules

Protected requests require `Authorization: Bearer <access-token>`. Roles are
`admin`, `pharmacist`, `cashier`, and `customer`; route permissions are
enforced by backend middleware. Registration creates customers only. Login
and registration are rate-limited, and logout revokes the user's session
version.

Medicine stock is derived from batches. Eligible sale batches must belong to
an active medicine, have positive quantity, and be unexpired; allocation is
FEFO. Purchases, sales, returns, and adjustments use database transactions.
See the root [README](../README.md) and
[technical report](../docs/TECHNICAL-REPORT.md) for architecture, setup,
data relationships, environment settings, and known limitations.

## Tests

```sh
npm test
npm run test:coverage
```

Node tests cover services, validators, models, and mocked API behavior. The
Jest/Supertest suite covers authentication/authorization HTTP behavior and
OpenAPI availability. Use a replica-set test database for additional
transaction integration testing before deployment.

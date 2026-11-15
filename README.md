# PharmaCare

Pharmacy Management System built with React, Vite, Tailwind CSS, Express, and MongoDB.

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- MongoDB running locally, or a MongoDB connection string

## Setup

Create the backend environment file from the example and edit it as needed:

```sh
cp server/.env.example server/.env
```

Keep real credentials in `server/.env`; environment files are ignored by Git. Never put backend secrets in client-side `VITE_*` variables.

Install dependencies if they are not already installed:

```sh
npm install --prefix client
npm install --prefix server
```

## Run locally

Start MongoDB first. In separate terminals, run:

```sh
npm run dev --prefix server
npm run dev --prefix client
```

The API listens on `http://localhost:5001` by default, and its readiness endpoint is `http://localhost:5001/api/health`. The Vite development server prints the frontend URL when it starts.

## Database models

Mongoose models live in `server/src/models/` and are re-exported from `server/src/models/index.js`. User, catalog, supplier, batch, purchase, and sale documents use Mongoose `createdAt`/`updatedAt` timestamps. Stock movements and audit logs are append-only records with their own `timestamp`.

- `User`: normalized unique email, hidden `passwordHash`, role, and active flag. Set the write-only `password` virtual; the model bcrypt-hashes it before saving and provides `comparePassword`.
- `Category` and `Medicine`: medicines reference a category; medicine stock is not duplicated on the medicine document.
- `Supplier` and `Batch`: batches reference a medicine and supplier, hold the available quantity and prices, and have a unique batch number per medicine.
- `Purchase`: references a supplier and embeds line items with medicine/batch references and purchase snapshots. Invoice numbers are unique per supplier.
- `Sale`: embeds medicine and batch references plus name, generic name, brand, batch number, quantity, and price snapshots so invoices retain their recorded product details. Sale invoice numbers are unique.
- `StockMovement`: references a medicine and batch, validates nonnegative stock transitions, and is append-only through the Mongoose model.
- `AuditLog`: references its actor and affected entity; log records are append-only through the Mongoose model.

The models define unique email/category/sale-invoice indexes, scoped batch and purchase-invoice unique indexes, and indexes for category, supplier, batch expiry, sale/purchase date, movement history, and audit history lookups.

Seed fictional demo catalog records into the MongoDB configured by `server/.env`:

```sh
npm run seed --prefix server
```

The seed is repeatable and inserts missing records only; it does not overwrite existing catalog or batch values. It is intended for a development database.

## Verify

```sh
npm run build --prefix client
npm run lint --prefix client
npm test --prefix server
```

# PharmaCare API Documentation

This reference was compiled from the Express routers, controllers, validators,
services, and OpenAPI definition in `server/src/`. The routes below are
implemented in the current repository. The API does not include endpoints
that are only implied by the UI or model schema.

## Base URL and API reference

- Local default base URL: `http://localhost:5001/api`
- OpenAPI JSON: `GET http://localhost:5001/api/docs.json`
- Swagger UI: `GET http://localhost:5001/api/docs`
- Health: `GET http://localhost:5001/api/health`

The configured origin is controlled by backend `PORT` and client
`VITE_API_URL`; the mounted API prefix is `/api`.

## Authentication and request format

Protected endpoints require the JWT access token returned by login or
registration:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Registration and login are public but rate-limited. Requests are JSON except
`GET /api/sales/:saleId/invoice/print`, which returns printable `text/html`.
The Express JSON body parser is limited to 10 KB.

### Roles

| Role | API permission summary |
| --- | --- |
| `admin` | Wildcard permissions; user administration and audit access |
| `pharmacist` | Catalog, supplier, purchase, inventory, sales, returns, and inventory reports |
| `cashier` | Medicine/inventory read, sales processing, permitted sales read, invoices, sales reporting |
| `customer` | Medicine read and own-sale/invoice permissions in the role map |

`GET /api/reports/stock-movements` is guarded by `inventory:read`, so the
implemented permission map also allows cashiers. The OpenAPI summary currently
lists only admin and pharmacist for that operation; the route middleware is
the actual enforcement source. Customers do not have a sales/invoice page in
the current workspace UI.

## Standard responses and errors

Successful endpoints return JSON unless explicitly listed as HTML or
no-content. Responses are not wrapped in a universal envelope: each
controller returns the shapes documented below.

Validation errors return HTTP 400 with this structure:

```json
{
  "error": "Invalid request",
  "details": [
    { "path": "body.email", "message": "Invalid email address" }
  ]
}
```

Other common errors return `{ "error": "message" }`:

| Status | Meaning |
| --- | --- |
| 400 | Invalid request, invalid state, or domain validation failure |
| 401 | Missing, invalid, expired, or revoked bearer token; invalid credentials |
| 403 | Authenticated user lacks permission, or a cashier accesses another user's sale |
| 404 | Requested record or completed invoice not found |
| 409 | Duplicate key, insufficient/concurrently changed stock, or business-rule conflict |
| 429 | More than 10 login/registration attempts per 15-minute window on this server process |
| 500 | Unexpected internal error; response is generic and server logs the exception |

Unmatched paths return 404. The health endpoint uses 503 when MongoDB is
disconnected. Logout and successful delete operations return 204 with no body.

## Pagination, filters, and validation rules

Paginated endpoints use `page` (integer, minimum 1, default 1) and `limit`
(integer 1–100, default 25) unless stated otherwise. The returned list shape
includes the relevant array, `total`, `page`, and `limit`. Most query/body
validators are strict: unknown fields are rejected. ObjectId values are
validated as MongoDB ObjectIds. Date range report inputs use ISO date-time
strings and reject `from` later than `to`.

## 1. Authentication

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Register customer | `POST /api/auth/register` | Creates a customer account and returns an access token. Public registration cannot set a role. | Public; rate-limited | None | `{name,email,password}`; trimmed name 1–120 chars, email valid/max 254, password 8–128 chars; no extra fields | 201 `{user,accessToken,tokenType:"Bearer"}` | 400 schema; 409 duplicate email; 429 rate limit |
| Login | `POST /api/auth/login` | Authenticates email/password and issues a JWT. | Public; rate-limited | None | `{email,password}`; valid email, password 1–128 chars; no extra fields | 200 `{user,accessToken,tokenType:"Bearer"}` | 400 schema; 401 generic invalid credentials; 403 deactivated account; 429 |
| Logout | `POST /api/auth/logout` | Increments session version to revoke the current user's existing tokens. | Bearer JWT; any active role | None | None | 204, no body | 401 invalid/revoked token |
| Current user | `GET /api/auth/me` | Returns the authenticated user's public profile. | Bearer JWT; any active role | None | None | 200 `{user:{id,name,email,role,isActive,createdAt}}` | 401 invalid/revoked token |

## 2. Users

All user-management endpoints require an authenticated `admin`.

| Endpoint | Method and URL | Description | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- |
| List users | `GET /api/auth/users` | Lists users newest first. | `page`, `limit` | None | 200 `{users:[...],total,page,limit}`; password hash and session version are not selected | 400 paging; 401; 403 |
| Change role | `PATCH /api/auth/users/:userId/role` | Sets role and increments that user's session version. | `userId`: valid ObjectId | `{role:"admin"|"pharmacist"|"cashier"|"customer"}`; no extra fields | 200 `{user}` | 400 invalid ID/body or admin trying to remove own admin role; 401; 403; 404 |
| Change activation | `PATCH /api/auth/users/:userId/activation` | Activates/deactivates a user and increments session version. | `userId`: valid ObjectId | `{isActive:boolean}` | 200 `{user}` | 400 invalid input or admin trying to deactivate own account; 401; 403; 404 |

## 3. Medicines

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Search/list medicines | `GET /api/medicines` | Searches and paginates catalog; partial `search` matches name or generic name. | Bearer; all roles with `medicine:read` | `search`, `name`, `genericName`, `category` ObjectId, `manufacturer`, `page`, `limit`, `sortBy` (`name`,`genericName`,`manufacturer`,`reorderLevel`,`createdAt`,`updatedAt`), `sortOrder` (`asc`,`desc`) | None | 200 `{medicines:[...],total,page,limit}`; each result includes derived `price` or `null`; customers receive a reduced public field set | 400 invalid query; 401; 403 |
| Create medicine | `POST /api/medicines` | Creates catalog data; stock is not set here. | Bearer; admin, pharmacist (`medicine:manage`) | None | Required: `name`, `genericName`, `category` ObjectId, `manufacturer`; optional `brand`, `description`, `reorderLevel` integer >=0, `isActive`; field lengths max 160/160/120/2000 as applicable; no extra fields | 201 `{medicine}` | 400 schema/category/validation; 401; 403 |
| Get medicine | `GET /api/medicines/:medicineId` | Returns medicine details and derived current price. | Bearer; all roles with `medicine:read` | `medicineId`: valid ObjectId | None | 200 `{medicine}`; inactive records are available only to admin/pharmacist | 400 invalid ID; 401; 403; 404 |
| Update medicine | `PATCH /api/medicines/:medicineId` | Updates one or more catalog fields. | Bearer; admin, pharmacist | `medicineId`: valid ObjectId | Non-empty subset of `name`, `genericName`, `brand`, `category`, `manufacturer`, `description`, `reorderLevel`, `isActive`; lengths and types as on create | 200 `{medicine}` | 400 invalid/empty patch or category; 401; 403; 404 |
| Delete medicine | `DELETE /api/medicines/:medicineId` | Deletes only if no batch, sale, or purchase references it. | Bearer; admin, pharmacist | `medicineId`: valid ObjectId | None | 204, no body | 400 invalid ID; 401; 403; 404; 409 referenced record |

Derived price is from the earliest eligible positive, unexpired batch. Medicine
creation does not create batches; inventory is added through purchase receipt.

## 4. Categories

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List categories | `GET /api/categories` | Lists categories alphabetically. | Bearer; all roles with `medicine:read` | None | None | 200 `{categories:[...]}` | 401; 403 |
| Create category | `POST /api/categories` | Creates a category. | Bearer; admin, pharmacist | None | Required `name` (1–100 chars); optional `description` (max 1000); strict object | 201 `{category}` | 400 schema; 401; 403; 409 duplicate name |
| Update category | `PATCH /api/categories/:categoryId` | Patches category fields. | Bearer; admin, pharmacist | `categoryId`: valid ObjectId | Non-empty subset of `name` (1–100), `description` (max 1000) | 200 `{category}` | 400 invalid/empty patch; 401; 403; 404; 409 duplicate name |
| Delete category | `DELETE /api/categories/:categoryId` | Deletes only if no medicine references it. | Bearer; admin, pharmacist | `categoryId`: valid ObjectId | None | 204, no body | 400 invalid ID; 401; 403; 404; 409 category referenced |

## 5. Suppliers

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Search/list suppliers | `GET /api/suppliers` | Searches name, contact, email, and phone; supports active filter and paging. | Bearer; admin, pharmacist (`supplier:read`) | `search` max 160, `isActive` (`true`/`false`), `page`, `limit`, `sortBy` (`name`,`createdAt`,`updatedAt`), `sortOrder` (`asc`,`desc`) | None | 200 `{suppliers:[...],total,page,limit}` | 400 query; 401; 403 |
| Create supplier | `POST /api/suppliers` | Creates a supplier. | Bearer; admin, pharmacist (`supplier:manage`) | None | Required `name` 1–160; optional `contactPerson` max 120, valid/empty email max 254, valid/empty phone max 40, `address` max 500; no extra fields | 201 `{supplier}` | 400 invalid fields; 401; 403; 409 duplicate/key conflict where applicable |
| Get supplier | `GET /api/suppliers/:supplierId` | Reads supplier by ID. | Bearer; admin, pharmacist (`supplier:read`) | `supplierId`: valid ObjectId | None | 200 `{supplier}` | 400 invalid ID; 401; 403; 404 |
| Update supplier | `PATCH /api/suppliers/:supplierId` | Patches supplier contact/status fields. | Bearer; admin, pharmacist (`supplier:manage`) | `supplierId`: valid ObjectId | Non-empty subset of `name`, `contactPerson`, `email`, `phone`, `address`, `isActive`; same type/length constraints as create | 200 `{supplier}` | 400 invalid/empty patch; 401; 403; 404; 409 duplicate/key conflict |
| Activate/deactivate supplier | `PATCH /api/suppliers/:supplierId/activation` | Sets supplier `isActive`. | Bearer; admin, pharmacist | `supplierId`: valid ObjectId | `{isActive:boolean}` | 200 `{supplier}` | 400 invalid input; 401; 403; 404 |
| Supplier purchase history | `GET /api/suppliers/:supplierId/purchases` | Lists paginated purchase records for a supplier. | Bearer; admin, pharmacist (`supplier:read`) | `supplierId`: ObjectId; `page`, `limit` | None | 200 `{purchases:[...],total,page,limit}` | 400 invalid ID/query; 401; 403; 404 |

No supplier deletion endpoint is implemented.

## 6. Purchases

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List purchases | `GET /api/purchases` | Lists purchase invoices, optionally filtered by supplier. | Bearer; admin, pharmacist (`purchase:manage`) | `supplier` optional ObjectId, `page`, `limit`, `sortOrder` (`asc`,`desc`) | None | 200 `{purchases:[...],total,page,limit}` | 400 query; 401; 403 |
| Receive purchase | `POST /api/purchases` | Atomically creates purchase, received batches, movements, and audit record. | Bearer; admin, pharmacist | None | `{supplier,items:[{medicine,batchNumber,quantity,purchasePrice,sellingPrice,expiryDate}]}`; 1–100 items, IDs valid, batch number 1–100 chars, integer quantity >0, finite nonnegative prices, date or offset datetime; duplicate medicine+batchNumber lines rejected | 201 `{purchase}` | 400 invalid/inactive supplier or medicine, expired batch, schema; 401; 403; 409 existing batch/invoice conflict |
| Get purchase | `GET /api/purchases/:purchaseId` | Returns purchase with supplier, processor, medicine, and batch details populated. | Bearer; admin, pharmacist | `purchaseId`: valid ObjectId | None | 200 `{purchase}` | 400 invalid ID; 401; 403; 404 |
Purchase money and invoice identifiers are generated by the server.
`expiryDate` must be in the future when the batch is received. Receipt
requires MongoDB transaction support.

## 7. Inventory

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List batches | `GET /api/batches` | Lists positive-quantity batches for active medicines in expiry order; expired excluded by default. | Bearer; admin, pharmacist (`inventory:manage`) | `medicine` optional ObjectId, `supplier` optional ObjectId, `includeExpired` (`true`,`false`), `page`, `limit`, `sortOrder` (`asc`,`desc`) | None | 200 `{batches:[...],total,page,limit}` | 400 query; 401; 403 |
| Available quantity | `GET /api/inventory/available/:medicineId` | Calculates eligible available quantity for active medicine. | Bearer; admin, pharmacist, cashier (`inventory:read`) | `medicineId`: valid ObjectId | None | 200 `{medicine:<id>,availableStock:number}` | 400 invalid ID; 401; 403; 404 inactive/missing medicine |
| Batch-wise eligible stock | `GET /api/inventory/batch-wise/:medicineId` | Lists positive unexpired batches sorted FEFO and total available quantity. | Bearer; admin, pharmacist, cashier | `medicineId`: valid ObjectId | None | 200 `{medicine,batches:[...],availableStock}` | 400 invalid ID; 401; 403; 404 |
| Low-stock alerts | `GET /api/inventory/low-stock` | Lists active medicines whose eligible stock is at or below reorder level. | Bearer; admin, pharmacist (`reports:inventory`) | None | None | 200 `{medicines:[...]}` | 401; 403 |
| Near-expiry alerts | `GET /api/inventory/near-expiry` | Lists positive-stock active-medicine batches expiring within warning period. | Bearer; admin, pharmacist | `warningDays` integer 1–365, default 30 | None | 200 `{batches:[...]}` | 400 invalid warningDays; 401; 403 |
| Expired batches | `GET /api/inventory/expired` | Lists positive-quantity expired batches for active medicines. | Bearer; admin, pharmacist | None | None | 200 `{batches:[...]}` | 401; 403 |
| Inventory valuation | `GET /api/inventory/valuation` | Calculates stock cost and retail valuation for positive batches belonging to active medicines. | Bearer; admin, pharmacist | None | None | 200 `{totalUnits,totalCostValue,totalRetailValue}`; all values are 0 when there is no qualifying stock | 401; 403 |
| Adjust batch stock | `POST /api/inventory/adjustments` | Applies a reasoned batch quantity delta, recording movement and audit. | Bearer; admin, pharmacist (`inventory:manage`) | None | `{batch,adjustmentType,quantityChange,reason}`; batch ObjectId, type in `damaged`,`expired`,`missing`,`physical_correction`,`other`; nonzero integer delta; reason 1–500 chars; damaged/expired/missing must be negative | 201 `{stockMovement}` | 400 validation or expired adjustment on unexpired batch; 401; 403; 404 batch; 409 negative result/concurrent change |

The valuation response properties are produced by
`getStockValuation()` in `server/src/services/inventoryService.js`; all stock
and monetary values are calculated from stored batches by the server.

## 8. Sales

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List sales | `GET /api/sales` | Lists sales; cashier is restricted to own records. | Bearer; admin, pharmacist, cashier (`sales:read:permitted`) | `page`, `limit`, `sortOrder` (`asc`,`desc`) | None | 200 `{sales:[...],total,page,limit}` | 400 query; 401; 403 |
| Process sale | `POST /api/sales` | Creates completed sale with FEFO allocation, server totals, movements and audit. | Bearer; admin, pharmacist, cashier (`sales:process`) | None | `{idempotencyKey,items:[{medicine,quantity}],discount?,paymentMethod}`; key 8–120 chars; 1–100 item lines; positive integer quantity, valid medicine ObjectId; finite discount >=0; payment method `cash`,`card`,`mobile_money`,`other`; no extra fields | 201 `{sale,replayed:false}`; matching retry returns 200 `{sale,replayed:true}` | 400 validation/discount ceiling; 401; 403; 404 active medicine; 409 insufficient/concurrent stock or altered idempotency reuse |
| Get sale | `GET /api/sales/:saleId` | Returns sale details; cashier may read only their own. | Bearer; admin, pharmacist, cashier (`sales:read:permitted`) | `saleId`: valid ObjectId | None | 200 `{sale}` | 400 invalid ID; 401; 403; 404 |
| Invoice data | `GET /api/sales/:saleId/invoice` | Returns invoice display fields. | Bearer; admin, pharmacist, cashier (`invoice:generate`); cashier own sale only | `saleId`: valid ObjectId | None | 200 `{invoice:{pharmacyName,invoiceNumber,dateTime,items,subtotal,taxRate,tax,discount,grandTotal,paymentMethod,cashierName}}` | 400 invalid ID; 401; 403; 404 |
| Printable invoice | `GET /api/sales/:saleId/invoice/print` | Returns escaped HTML invoice with print action. | Bearer; admin, pharmacist, cashier; cashier own sale only | `saleId`: valid ObjectId | None | 200 `text/html` | 400 invalid ID; 401; 403; 404 |

Sale totals and line prices are computed by the server. `discount` is a fixed
amount, constrained by `MAX_SALE_DISCOUNT_PERCENT`; tax uses
`SALES_TAX_RATE`. The endpoint requires a transaction-capable MongoDB
deployment.

## 9. Returns

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List returns | `GET /api/returns` | Lists returns newest first with sale and processor populated. | Bearer; admin, pharmacist (`sales:return`) | `page`, `limit` | None | 200 `{returns:[...],total,page,limit}` | 400 query; 401; 403 |
| Record return | `POST /api/returns` | Records an idempotent return against a completed invoice; does not restock batch. | Bearer; admin, pharmacist | None | `{idempotencyKey,invoiceNumber,reason,items:[{batch,quantity}]}`; key 8–120 chars, invoice 1–100, reason 1–500, 1–100 items, valid batch ObjectId and positive integer quantity; strict | 201 `{return,replayed:false}`; matching retry 200 with `replayed:true` | 400 validation or batch not in sale; 401; 403; 404 completed invoice; 409 exceeds unreturned sold quantity/concurrent change/altered key reuse |

The returned record status is initially `pending_inspection`. The current API
does not implement return inspection, refund settlement, or return-to-stock
processing.

## 10. Stock Movements

There is no standalone `/api/stock-movements` router. The implemented
movement-history read is under reports; movement creation happens as part of
purchase, sale, and adjustment writes.

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List stock movement history | `GET /api/reports/stock-movements` | Returns filtered append-only movements, newest first, with medicine/batch/actor populated. | Bearer; users with `inventory:read` (admin, pharmacist, cashier) | Optional `medicine`, `batch` ObjectIds; `movementType` in `purchase`,`sale`,`return`,`adjustment`; optional ISO date-time `from`,`to`; `page`,`limit`; `from` must not follow `to` | None | 200 `{movements:[...],total,page,limit}` | 400 invalid filter/date range; 401; 403 |

## 11. Reports

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard metrics | `GET /api/reports/dashboard` | Returns live counts, sales/revenue totals, inventory alerts, and recent completed sales. | Bearer; admin, pharmacist | None | None | 200 metrics object (`totalMedicines`, `totalSuppliers`, `totalAvailableStock`, `todaySales`, `monthlySales`, `totalRevenue`, alert arrays, `recentSales`) | 401; 403 |
| Sales report | `GET /api/reports/sales` | Aggregates completed sales by period and returns summary. Cashier results are scoped to own sales. | Bearer; admin, pharmacist, cashier | `period` (`daily`,`weekly`,`monthly`, default daily), optional ISO `from`,`to`, `page`,`limit`; from <= to | None | 200 `{period,results,summary,page,limit}` | 400 invalid query/range; 401; 403 |
| Stock report | `GET /api/reports/stock` | Reconciles movement history with current stock and valuation. | Bearer; users with `reports:inventory` (admin, pharmacist) | Optional ISO `from`,`to`, optional `medicine` ObjectId, `page`,`limit`; from <= to | None | 200 `{medicines:[...],total,page,limit,from,to}` | 400 invalid query; 401; 403 |
| Expiry report | `GET /api/reports/expiry` | Groups expired batches and near-expiry batches within 30, 60, and 90 days. | Bearer; users with `reports:inventory` (admin, pharmacist) | None | None | 200 `{expired,within30Days,within60Days,within90Days}` | 401; 403 |
| Supplier report | `GET /api/reports/suppliers` | Aggregates supplier purchase counts, spend, and invoice summaries. | Bearer; users with `reports:inventory` (admin, pharmacist) | Optional ISO `from`,`to`, optional `supplier` ObjectId, `page`,`limit`; from <= to | None | 200 `{suppliers:[...],summary,total,page,limit}` | 400 invalid query; 401; 403 |

## 12. Audit Logs

There is no separate audit-log router. The implemented audit history endpoint
is under reports. Audit records are created by selected business services;
there is no API for clients to create, edit, or delete audit entries.

| Endpoint | Method and URL | Description | Authentication / roles | Parameters | Request body | Success | Errors and validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List audit history | `GET /api/reports/audit` | Returns append-only audit entries newest first with actor populated. | Bearer; admin only | `page`, `limit` | None | 200 `{entries:[...],total,page,limit}` | 400 paging; 401; 403 |

## Health and API documentation

These are implemented Express endpoints that do not belong to a protected
business router.

| Endpoint | Method and URL | Description | Authentication | Parameters/body | Success | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| Health | `GET /api/health` | Reports API and MongoDB connection readiness. | None | None | 200 `{status:"ok",database:"connected"}` | 503 `{status:"unavailable",database:"disconnected"}` |
| OpenAPI JSON | `GET /api/docs.json` | Serves generated OpenAPI 3.0.3 definition. | None | None | 200 OpenAPI document | No documented application error response |
| Swagger UI | `GET /api/docs` | Serves interactive Swagger UI for the OpenAPI definition. | None | None | 200 HTML UI | No documented application error response |

## Request and response examples

Examples use synthetic values and are illustrative; access tokens and ObjectIds
below are not credentials for any deployment.

### Login

```json
{
  "email": "cashier@example.test",
  "password": "example-password"
}
```

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Example Cashier",
    "email": "cashier@example.test",
    "role": "cashier",
    "isActive": true,
    "createdAt": "2026-01-01T10:00:00.000Z"
  },
  "accessToken": "<JWT omitted>",
  "tokenType": "Bearer"
}
```

### Create medicine

```json
{
  "name": "Example Medicine 10 mg",
  "genericName": "Example Ingredient",
  "brand": "Example Brand",
  "category": "507f1f77bcf86cd799439012",
  "manufacturer": "Example Manufacturer",
  "description": "Catalog description",
  "reorderLevel": 10,
  "isActive": true
}
```

### Receive a purchase

```json
{
  "supplier": "507f1f77bcf86cd799439013",
  "items": [
    {
      "medicine": "507f1f77bcf86cd799439014",
      "batchNumber": "LOT-EXAMPLE-001",
      "quantity": 40,
      "purchasePrice": 2.5,
      "sellingPrice": 4,
      "expiryDate": "2028-12-31"
    }
  ]
}
```

### Process a sale

```json
{
  "idempotencyKey": "pos-request-000001",
  "items": [
    {
      "medicine": "507f1f77bcf86cd799439014",
      "quantity": 2
    }
  ],
  "discount": 0,
  "paymentMethod": "cash"
}
```

### Record a return

```json
{
  "idempotencyKey": "return-request-0001",
  "invoiceNumber": "SALE-EXAMPLE",
  "reason": "Customer returned unopened item",
  "items": [
    {
      "batch": "507f1f77bcf86cd799439015",
      "quantity": 1
    }
  ]
}
```

### Stock adjustment

```json
{
  "batch": "507f1f77bcf86cd799439015",
  "adjustmentType": "damaged",
  "quantityChange": -1,
  "reason": "One unit damaged during handling"
}
```

## API security notes

- `authenticate` validates bearer JWTs, account activation, and session
  version against `User`.
- `requirePermission` and `requireRoles` enforce backend access independently
  of frontend navigation.
- Public registration assigns the `customer` role only.
- Zod request validators reject malformed values and unknown fields on
  validated routes; Mongoose schemas add persistence-level constraints.
- Login/register share a process-local rate limiter (10 attempts per
  15-minute window).
- `helmet`, configured CORS, and a 10 KB JSON body limit are applied in
  `server/src/app.js`.
- MongoDB credentials and `JWT_SECRET` are backend-only settings; do not send
  them to the client or include them in API examples.
- Sale, purchase, return, and adjustment workflows use MongoDB transactions
  and require a replica set or `mongos`.

## Incomplete or absent API capabilities

- No payment gateway or payment authorization endpoint is implemented.
- No customer-facing order creation/history API is exposed as a dedicated
  customer workflow.
- Returns can be recorded and listed, but inspection/disposition and
  restocking endpoints are absent.
- Suppliers have activation/deactivation but no delete endpoint.
- There is no direct stock-movement or audit-log write endpoint; the services
  create those records as part of supported workflows.
- No API export, CSV, or report-download endpoint is implemented.

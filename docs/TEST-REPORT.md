# PharmaCare Test Report

**Execution date:** 2026-11-15
**Repository revision at execution:** `28bc4f12699630e70d76f6f9b6a4027f3f1b093f`
**Environment:** macOS, Node.js v25.2.1, npm 11.6.2
**Scope:** Backend automated suite plus frontend lint and production build. No
live MongoDB transaction integration or authenticated browser workflow was
run.

## 1. Test framework and configuration

- Backend service, model, validator, report, and API tests use the Node.js
  built-in test runner from `server/test/*.test.js`.
- The HTTP integration suite uses Jest 30 and Supertest; Jest is configured
  by `server/jest.config.js`, runs in the Node environment, and matches
  `server/test/jest/**/*.test.js`.
- Frontend automated quality commands are ESLint and Vite production build.
  The repository does not define a frontend unit-test runner or browser
  end-to-end suite.

## 2. Test execution commands

Commands executed from the repository root:

```sh
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
```

Additional configured commands (not run in this report):

```sh
npm run test:coverage --prefix server
npm run test:jest --prefix server
```

## 3. Test environment and methodology

The Node test suite runs against Node.js mocks/stubs for Mongoose models,
sessions, and database operations where appropriate. This allows deterministic
validation of service rules, query construction, response behavior, and
transaction callback behavior without requiring a connected MongoDB server.
The API tests use HTTP requests against the Express app and verify routing,
authorization, validation, and error responses. The Jest/Supertest tests
exercise HTTP authentication and authorization behavior with controlled
fixtures/mocks.

These are not equivalent to executing transactions on a real MongoDB replica
set. No external service, production database, performance benchmark, or
multi-process concurrency test was used.

## 4. Result summary

| Verification | Result | Evidence |
| --- | --- | --- |
| Node built-in backend tests | **PASSED** | 66 tests; 66 passed, 0 failed, 0 skipped |
| Jest/Supertest suite | **PASSED** | 1 suite; 6 tests passed, 0 failed |
| Frontend ESLint | **PASSED** | `npm run lint --prefix client` exited successfully |
| Frontend production build | **PASSED** | `npm run build --prefix client` built `client/dist/` successfully |
| MongoDB replica-set integration | **NOT TESTED** | No live transaction-capable MongoDB execution in this run |
| Full UI browser workflow | **NOT TESTED** | No authenticated role workflow was performed |
| Coverage command / numeric coverage | **NOT TESTED** | `test:coverage` was not run; no coverage percentage is claimed |

## 5. Detailed test cases

“Actual result” below records observed suite evidence, not an independently
repeated manual test. Cases marked **NOT TESTED** have no directly matching
automated test in the executed suite or require a real external environment.

| Test ID | Test description | Preconditions | Test input | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Login with valid credentials | User fixture and mocked password comparison | Valid email and password | 200 response with bearer token and public user | `login returns a bearer access token for valid credentials` passed | PASSED |
| AUTH-02 | Reject invalid credentials without revealing account existence | Auth service/API test fixture | Invalid email/password pair | Generic 401 error | `login rejects invalid credentials with a generic response` passed; Jest HTTP case also passed | PASSED |
| AUTH-03 | Reject expired access token | JWT test secret and expired token | Expired bearer JWT | 401 response | `authentication middleware rejects expired access tokens` and Jest case passed | PASSED |
| AUTH-04 | Reject malformed registration request | Express app and validator | Missing/invalid registration fields | 400 validation response | `authentication routes reject malformed request data` passed | PASSED |
| AUTH-05 | Limit repeated login attempts | Auth rate limiter enabled in test app | More than configured attempts | Later attempts return 429 | Jest rate-limit test passed | PASSED |
| AUTH-06 | Revoke existing session after logout/version update | User/session fixture | Token with stale session version | Token rejected | Logout revocation behavior was not individually exercised in the executed named tests | NOT TESTED |
| AUTHZ-01 | Require authentication for medicine and category APIs | Express app | Requests without bearer token | 401 | `medicine and category APIs require authentication` passed | PASSED |
| AUTHZ-02 | Prevent customer catalog management | Authenticated customer fixture | Create medicine/category requests | 403 | `customer cannot create medicines or categories` passed | PASSED |
| AUTHZ-03 | Enforce supplier, purchase, sales, and inventory permissions | Express app with role fixtures | Disallowed role plus invalid authorized requests | 403 for denied roles; schema error for invalid allowed-role payload | `supplier APIs enforce manager permissions...` and `purchase, sales and inventory APIs enforce roles...` passed | PASSED |
| AUTHZ-04 | Reject customer inventory-adjustment access over HTTP | HTTP app and customer token fixture | POST adjustment | 403 | Jest authorization test passed | PASSED |
| MED-01 | Validate required medicine fields and prevent direct stock writes | Medicine schema and validator | Missing required field or stock field | Invalid write rejected; no stock field accepted | `medicine validators require core fields and reject stock mutation` passed | PASSED |
| MED-02 | Search by partial case-insensitive name or generic name | Mocked medicine query | Short search fragment | Matching catalog records returned | `medicine search matches a short case-insensitive name or generic-name fragment` passed | PASSED |
| MED-03 | Apply medicine filters, pagination, and sort safely | Mocked query and count | Category/search/page/sort values | Correct filter, stable sort, page and total | Corresponding medicine listing test passed | PASSED |
| MED-04 | Derive catalog price from earliest eligible batch | Mocked aggregate response | Multiple batch prices including ineligible rows | Earliest eligible batch price returned | `customer catalog prices come from the earliest eligible batch only` passed | PASSED |
| MED-05 | Block deletion of referenced medicine/category | Mocked reference existence checks | Delete referenced medicine/category | 409 conflict | Medicine and category deletion constraint tests passed | PASSED |
| MED-06 | Full CRUD persistence against a live database | Transaction-capable MongoDB and API fixture | Create/read/update/delete requests against real collections | Persisted values and indexes behave correctly | No live database CRUD scenario was run | NOT TESTED |
| SUP-01 | Validate supplier email, phone, and strict fields | Supplier Zod/Mongoose schemas | Valid and invalid records | Valid fields accepted; invalid formats rejected | Validator and model tests passed | PASSED |
| SUP-02 | Search/filter/paginate suppliers and retrieve purchase history | Mocked supplier/purchase models | Search/status/page query | Matching page and history response | `supplier search/filter/pagination and purchase history are applied` passed | PASSED |
| SUP-03 | Supplier create/get/update service behavior | Mocked models | Valid create/update and missing ID | Correct result or 404 | `supplier create, get, and update services work and report missing suppliers` passed | PASSED |
| PUR-01 | Reject zero quantity and malformed expiry date | Purchase validator | Invalid line item | 400 validation rejection | `purchase validation rejects zero quantities and malformed expiry dates` passed | PASSED |
| PUR-02 | Receive purchase atomically | Mocked Mongo session and models | Active supplier/medicine and valid batch line | Purchase, batch, movement, audit created in transaction | `purchase transaction creates invoice, batches, purchase and stock movements atomically` passed | PASSED |
| PUR-03 | Abort purchase when movement or audit write fails | Transaction callback mocks | Inject movement/audit write error | Transaction failure propagates; no success response | Both failure-propagation tests passed | PASSED |
| PUR-04 | Reject receiving an already expired batch | Transaction-capable DB or batch-service stub | Expiry at/before current date | Purchase rejected with 400 | Batch service implements this guard, but no direct matching executed test was observed | NOT TESTED |
| INV-01 | Reject negative or fractional batch quantity | Mongoose model validation | Negative and fractional values | Batch validation fails | Batch model test passed | PASSED |
| INV-02 | FEFO allocation across earliest-expiring batches | Mocked batch query/update | Request spans multiple eligible batches | Earlier expiry consumed first and remaining drawn from next | `FEFO allocation consumes earliest unexpired batch then continues to the next` passed | PASSED |
| INV-03 | Reject insufficient or zero stock without changing batches | Mocked eligible batch set | Zero or more units than available | Conflict/rejection and no partial allocation | FEFO insufficient/zero-stock test passed | PASSED |
| INV-04 | Guard concurrent FEFO changes against overselling | Mocked conditional update outcome | Batch quantity changes between read and update | Conditional update rejects allocation | FEFO concurrent quantity-guard test passed | PASSED |
| INV-05 | Exclude expired batches and inactive medicines from availability | Mocked medicine/batch queries | Mixed active/expired/empty inventory | Only sellable inventory counted | Available and batch-wise stock test passed | PASSED |
| INV-06 | Low-stock alert uses available stock and reorder level | Mocked aggregate result | Active medicines at, below, above threshold | Only at/below threshold listed | Low-stock alert test passed | PASSED |
| INV-07 | Near-expiry alert excludes expired/empty stock | Mocked clock and batch aggregation | Expired, empty, near, and distant expiry rows | Only positive stock within configured window listed | Near-expiry alert test passed | PASSED |
| INV-08 | Expired batch alert | Mocked clock and aggregation | Positive expired and non-expired/empty rows | Only positive expired batches listed | Expired-alert test passed | PASSED |
| INV-09 | Reject expired-stock adjustment on an unexpired batch | Mocked transaction and batch | `adjustmentType=expired` on future expiry | 400 rejection | `expired-stock adjustment rejects a batch that has not expired` passed | PASSED |
| INV-10 | Verify stock valuation calculation | Mocked aggregate | Active batch quantities and prices | Cost/retail totals calculated | Stock valuation test passed | PASSED |
| SALE-01 | Process sale using FEFO and batch prices; generate invoice/movements | Mocked transaction, batches, environment tax | Multiple item quantities and payment method | Completed sale, correct totals, movements and invoice data | Successful FEFO sale test passed | PASSED |
| SALE-02 | Reject insufficient or expired-only stock | Mocked allocator and batches | Sale item without enough eligible quantity | Sale fails; no successful sale record | `sale rejects insufficient or expired-only stock` passed | PASSED |
| SALE-03 | Enforce discount ceiling | Configured environment fixture | Discount above server maximum | 400 rejection | Discount ceiling test passed | PASSED |
| SALE-04 | Idempotent sale retry and altered payload | Existing sale fixture and request hash | Same key/same request then same key/different request | Replay same sale; reject changed payload | Idempotency test passed | PASSED |
| SALE-05 | Sale transaction aborts on movement/audit failure | Transaction mocks | Inject movement or audit write error | Error propagated and workflow not reported successful | Sale failure-propagation test passed | PASSED |
| SALE-06 | Concurrent sales cannot oversell a shared batch | Conditional batch update mocks | Two allocations competing for same stock | One cannot commit against stale quantity | Concurrent sale test passed | PASSED |
| SALE-07 | Execute concurrent sales against real MongoDB replica set | Replica-set test database and simultaneous HTTP clients | Competing sales for the last units | At most available quantity sold | No live-database concurrency test was run | NOT TESTED |
| SALE-08 | Printable HTML invoice in a browser | Authenticated account and browser | Sale with invoice print action | HTML renders and print flow works in browser | HTTP/browser print workflow not exercised in this test run | NOT TESTED |
| RET-01 | Validate return body and idempotency key | Return Zod schema | Missing invoice/reason, invalid quantity/key | Invalid request rejected | Return validator test passed | PASSED |
| RET-02 | Record eligible return and set pending inspection | Mocked Sale/Return/Audit models and transaction | Return quantity within remaining sold quantity | Return, returned count, audit saved; no restock | Return behavior test passed | PASSED |
| RET-03 | Reject return above remaining eligible quantity | Sale fixture with previous returned quantity | Quantity exceeding remaining amount | 409 rejection | Excess-quantity test passed | PASSED |
| RET-04 | Reject concurrent excessive return | Conditional update mock | Competing return changes returned count | Conflict and no over-return | Concurrent return test passed | PASSED |
| RET-05 | Replay same return key, reject changed request | Existing return/request hash | Same key same/different payload | Replay or 409 as appropriate | Return idempotency test passed | PASSED |
| ADJ-01 | Reject zero delta and positive damaged adjustment | Stock adjustment validator | Invalid delta/type combinations | Request rejected | Adjustment validator test passed | PASSED |
| ADJ-02 | Atomically adjust batch and create movement/audit | Mocked session and models | Valid adjustment | Quantity, movement, audit transaction succeeds | Atomic adjustment test passed | PASSED |
| MOV-01 | Validate movement quantity transition and append-only behavior | Mongoose model tests | Inconsistent before/delta/after; update/delete attempts | Validation or mutation rejection | StockMovement validation and append-only tests passed | PASSED |
| MOV-02 | Query movement history endpoint with filters against live data | HTTP app and MongoDB test records | Date/type/medicine/batch filters | Paginated filtered movement response | No direct executed test of the history endpoint was observed | NOT TESTED |
| RPT-01 | Sales report date grouping and totals | Mocked sale aggregation | Period and date bounds | Correct revenue/summary output | Sales report test passed | PASSED |
| RPT-02 | Stock report movement reconciliation | Mocked movement and batch aggregates | Date range and medicine stock | Opening/movement/closing and difference returned | Stock report test passed | PASSED |
| RPT-03 | Supplier report spend/count | Mocked purchases and supplier aggregate | Date/supplier filter | Grouped purchase metrics returned | Supplier report test passed | PASSED |
| RPT-04 | Dashboard metrics derive from database queries | Mocked models/aggregations | Sales, stock, alerts, suppliers | Aggregated dashboard values returned | Dashboard metrics test passed | PASSED |
| RPT-05 | Audit history endpoint permissions and live pagination | HTTP app and persisted audit entries | Admin and non-admin requests | Admin may view; other roles denied | No direct executed audit-history endpoint test was observed | NOT TESTED |
| UI-01 | End-to-end login and purchase-to-sale browser journey | Running client/API and seeded transaction-capable MongoDB | Sign in, receive purchase, sell, print invoice | All screens and persisted values match | No authenticated browser journey was executed | NOT TESTED |

## 6. Category coverage summary

| Requested category | Evidence in executed suite | Result |
| --- | --- | --- |
| Authentication | Login, invalid credentials, token expiry, malformed registration, rate limiting | Tested; logout revocation needs direct test |
| Role-based authorization | Route-level denials and customer inventory restriction | Tested for listed cases; not every route/role pair |
| Medicine CRUD | Validation, query behavior, constraints, delete references | Partial; live HTTP/database CRUD not tested |
| Supplier management | Validation, model, service, filtering, purchase history | Tested with mocks; not live DB |
| Purchase processing | Validation, transaction orchestration and rollback on failures | Tested with mocks; live transaction not tested |
| Batch inventory | Model constraints, batch availability, valuation | Tested with mocks/model validation |
| FEFO algorithm | Ordered allocation and conditional update behavior | Tested with mocks |
| Expired batch rejection | Expired inventory excluded; expired adjustment guard | Purchase receipt expiry rejection lacks direct test |
| Low-stock alerts | Threshold behavior | Tested with mocked aggregation |
| Near-expiry alerts | Warning period and excluded rows | Tested with mocked aggregation |
| Sales and invoicing | Sale calculations, idempotency, concurrency guards, invoice data | Service tests pass; printable browser workflow not tested |
| Returns and stock adjustments | Eligibility, over-return, idempotency, adjustment movement/audit | Service tests pass with mocks |
| Stock movement history | Ledger model and stock report calculations | History query endpoint needs direct test |
| Dashboard and reporting | Sales, stock, supplier, dashboard services | Tested with mocks |

## 7. Integration and reliability limitations

- No test connected to a live MongoDB replica set or `mongos`; transaction
  guarantees, driver retry behavior, unique index creation, and actual
  concurrent writes remain unverified here.
- Concurrency cases test conditional update handling with controlled test
  doubles; they do not prove cross-process database isolation.
- Jest/Supertest tests exercise HTTP behavior but do not validate the full
  application against persistent production-like data.
- The frontend has lint/build checks but no configured component/unit or
  browser end-to-end test runner.
- The available shared browser page was not used for a clean authenticated
  workflow. Its event history included Vite/React errors from prior hot
  reloads; this is not treated as a fresh reproduction or as passing UI
  evidence.
- The coverage command was not run, and no numeric coverage claim is made.

## 8. Recommended next QA work

1. Add a disposable replica-set integration environment and verify transaction
   rollback, idempotency indexes, and concurrent stock updates using real
   MongoDB.
2. Add direct route tests for expired purchase receipt rejection, stock
   movement filtering, audit permissions, and all role/route combinations.
3. Add UI component and end-to-end tests for login, user management,
   purchase, FEFO sale, invoice print, return, and adjustment journeys.
4. Run `npm run test:coverage --prefix server` and review uncovered critical
   business paths; report the generated figures only after execution.
5. Capture clean browser screenshots and repeat the role-specific manual
   acceptance checklist in a fresh browser session.

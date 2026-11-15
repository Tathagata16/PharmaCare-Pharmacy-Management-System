# PharmaCare Assessment Submission Checklist

This is an evidence-based readiness checklist for the Pharmacy Management
System assessment criteria supplied for Algions AI Labs. It records
implementation status, not marks. **No numeric score is awarded or implied.**
“Complete” means the repository contains the feature/documentation evidence
listed; it does not certify production readiness.

## Assessment criteria

| Criterion | Weight | Required features | Status | Implemented evidence | Remaining gap / qualification | Evidence to prepare |
| --- | ---: | --- | --- | --- | --- | --- |
| Core business workflows | 30 marks | Catalog CRUD/search; suppliers; purchase receipt; batch stock; FEFO sale and invoice; returns/adjustments; reports | **PARTIAL** | Medicine/category/supplier catalog; purchases create batches; FEFO sales and invoice; stock adjustments; returns; reports/dashboard. Services/routes in `server/src/`; UI pages in `client/src/pages/WorkspacePages.jsx`. | No payment gateway; return inspection/refund disposition and restocking not implemented; customer order workflow is not present; real-database transaction deployment not verified. | Fresh admin/pharmacist/cashier walkthrough; redacted purchase-to-sale invoice; show returned item remains pending inspection; demonstrate stock and movement before/after. |
| Architecture, database and APIs | 20 marks | Client/server architecture; persisted schema and relationships; route inventory; validation/auth flow; data lifecycle | **COMPLETE** | Layered React/Express/Mongoose architecture; 10 registered models; OpenAPI/Swagger; docs for architecture, ER model, and API routes. | ObjectId references are application-level rather than MongoDB foreign keys; verify documentation against final revision after commit. | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`ER-DIAGRAM.md`](./ER-DIAGRAM.md), [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md), `/api/docs`, actual source links. |
| Security and data integrity | 15 marks | Password/token security; backend authorization; validation; safe inventory writes; audit/history | **PARTIAL** | bcrypt password hashing; JWT/session version; role/permission middleware; Zod and Mongoose validation; Helmet/CORS; rate limiting; transaction-backed workflows; append-only movement/audit models. | Bearer token stored in browser `localStorage`; auth rate limit is process-local; no independent security review; production TLS/secrets/backup controls are not configured in repository; live transaction semantics untested. | Demonstrate public registration cannot assign staff role; show role denial and session behavior; provide deployment secret/CORS configuration; attach external security review only if actually performed. |
| UI/UX and responsiveness | 10 marks | Role-appropriate navigation; usable forms and feedback; responsive layout; cross-device acceptance | **PARTIAL** | Responsive breakpoints, collapsible mobile navigation, role-filtered workspace navigation, loading/error/empty states, responsive tables/forms. Frontend lint/build pass. | No clean role-by-role browser acceptance run or final screenshots are included; behavior on target browsers/devices has not been measured. | Capture current login, dashboard, catalog, purchase, inventory, POS/invoice, and reports screenshots; test desktop and mobile widths; redact account data. |
| Testing and reliability | 15 marks | Positive/negative tests; API tests; integration and concurrency tests; recorded results | **PARTIAL** | Backend automated suites passed: 66 Node tests and 6 Jest/Supertest tests. Client ESLint and Vite production build passed. Detailed evidence and gaps are in [`TEST-REPORT.md`](./TEST-REPORT.md). | No live MongoDB replica-set integration, frontend unit/E2E tests, real cross-process concurrency test, coverage run, or production reliability evidence. | Attach test command logs from final commit; run replica-set integration and browser workflows; report coverage only if `test:coverage` is run. |
| Documentation and demonstration | 10 marks | Professional technical/user/API docs; setup; screenshots; demo; video; attribution; limitations | **PARTIAL** | README, technical report, architecture, ER diagram, API reference, test report, user guide, deployment guide, AI attribution, and this checklist are being prepared in `docs/`. | Candidate/registration details, screenshots, video, public demo URL, demo account details, and final committed revision remain to be supplied/verified. | Complete placeholders, commit docs, record a walkthrough, provide safe demo access instructions, and update final commit ID. |

## Required final submission artifacts

| Requirement | Current evidence/status | Final action |
| --- | --- | --- |
| GitHub repository URL | `https://github.com/sourodip19/PharmaCare-Pharmacy-Management-System` | Confirm repository visibility and access for assessors |
| Primary branch | `main` | Confirm all final work is pushed to the intended branch |
| Final commit ID | Current inspected base revision: `28bc4f12699630e70d76f6f9b6a4027f3f1b093f`; documentation files in this submission batch are not yet committed | Update this field after all final documentation is committed and pushed |
| Demo URL / local-only declaration | **No public deployment is configured or verified.** Local development uses a Vite client (normally `http://localhost:5173`) and API (`http://localhost:5001`). | Declare local-only unless a public deployment is actually tested; do not present localhost as a public demo URL |
| API documentation | `docs/API-DOCUMENTATION.md`; live OpenAPI/Swagger routes are `/api/docs.json` and `/api/docs` when API runs | Verify route list against final branch and attach live Swagger screenshot if available |
| ER diagram | `docs/ER-DIAGRAM.md` | Render Mermaid in the final submission platform and review entity links |
| Technical report | `docs/TECHNICAL-REPORT.md` | Fill candidate and registration placeholders; add actual screenshots if required |
| Architecture document | `docs/ARCHITECTURE.md` | Keep synchronized with any final code changes |
| Test evidence | `docs/TEST-REPORT.md`; current observed run: 66 Node tests and 6 Jest tests passed; client lint/build passed | Re-run from final commit; retain terminal logs; state explicitly that MongoDB replica-set tests are not included |
| User guide | `docs/USER-GUIDE.md` | Attach screenshots captured from the final UI |
| Deployment guide | `docs/DEPLOYMENT-GUIDE.md` | Do not claim production deployment unless verified |
| Walkthrough video | **TODO — no video is included** | Record a short demo using non-sensitive test data; cover each role and key flows |
| AI attribution | `docs/AI-ATTRIBUTION.md` | Candidate must verify tools, complete statement, and comply with organization policy |
| Demo credentials | **TODO — no credentials are documented or embedded** | Create temporary least-privilege demo accounts privately; share credentials only via an approved secure channel, never in the repository |
| Known limitations | README, technical report, test report, user guide | Review and disclose limitations during the demonstration |
| Candidate name / registration number | Placeholders in technical report | Complete before submission |
| License / external asset attribution | Root project license not present; `hero.png` source is unverified | Obtain owner approval for a source license and verify/replace/attribute the asset |

## Prioritized remaining tasks

1. **Commit and push the final documentation and code revision.** Then update
   this checklist with the final commit hash and rerun verification on that
   exact commit.
2. **Prepare the demo environment securely.** Use a transaction-capable
   MongoDB deployment, private secrets, exact production CORS origin, and
   temporary non-sensitive demo accounts. The repository has no verified
   hosted deployment.
3. **Run real MongoDB integration checks.** Verify transaction rollback,
   unique indexes, purchase/sale/adjustment consistency, and competing sales
   against a replica set or `mongos`.
4. **Perform final role-based browser acceptance.** Test admin, pharmacist,
   cashier, and customer behavior in a clean browser session; capture
   redacted screenshots and investigate any console/network errors.
5. **Complete assessment-specific material.** Fill candidate/registration
   placeholders, record a walkthrough video, add screenshots, and confirm
   the AI attribution and asset/license statements.
6. **Review and explain known workflow limitations.** In particular,
   payments are not processed, returns remain pending inspection and are not
   restocked, and seeded opening stock has no opening stock-movement records.
7. **Re-run all documented checks and retain evidence.** Run backend tests,
   frontend lint/build, plus any new integration/E2E tests; do not add
   unverified performance or coverage claims.

## Known limitations to disclose

- Payment methods are recorded, but no payment gateway charges a payment
  instrument.
- Return processing records pending-inspection returns but does not implement
  inspection, settlement, or restocking.
- Public registration creates customers only; staff/admin accounts require
  private administrator setup.
- Customer catalog/profile pages exist, but customer order placement and
  purchase-history screens are not implemented.
- Database transactions require a replica set or `mongos`.
- Seeded opening batch balances are not represented in stock movement history.
- Local test suites mock database operations; production-like transaction
  integration and UI end-to-end testing remain outstanding.

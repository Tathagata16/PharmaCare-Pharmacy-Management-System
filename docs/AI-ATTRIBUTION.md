# PharmaCare AI-Assisted Development Attribution

This statement distinguishes assistance that is verifiable in the project
work history from tools, authorship, and human decisions that require
confirmation by the candidate or project owner. It does not claim that the
entire codebase was written by the candidate or by an AI tool.

## 1. AI tools used

| Tool | Attribution status | Purpose/evidence |
| --- | --- | --- |
| GitHub Copilot, accessed as an AI assistant using Copilot SDK in VS Code | **Verified in this development/documentation work** | Assisted with code investigation, implementation/debugging tasks, and generation/revision of project documentation in this repository workflow |
| Cursor AI | **Not verified** | No evidence in the available project/session context confirms that Cursor AI was used. Candidate: mark whether used and describe scope, or remove this row in the final submission |
| ChatGPT | **Not verified** | No evidence in the available project/session context confirms separate ChatGPT use. Candidate: mark whether used and describe scope, or remove this row |
| Other tools | **TODO** | Add any additional AI tools actually used, with purpose and scope |

## 2. Purpose and areas of AI assistance

Within the verifiable Copilot-assisted work history, AI assistance included:

- Reviewing existing MERN application code and tracing relevant routes,
  services, models, UI behavior, and configuration before making changes.
- Drafting and refining implementation changes and regression tests for
  pharmacy catalog/search, initial-admin setup, role-management behavior,
  stock adjustments, and related workflows.
- Helping diagnose reported application issues against the actual code.
- Preparing the project README, technical internship report, architecture
  document, and the documentation requested in this submission batch.
- Running and interpreting the configured backend tests, frontend lint, and
  Vite build during the current documentation preparation.

These are descriptions of assisted work, not a declaration that all
repository code originated in this session or that every generated
suggestion was accepted unchanged.

## 3. Human review, decisions, and testing responsibilities

AI output is an aid, not a substitute for project-owner responsibility. The
candidate/maintainer must:

1. Review the submitted code and documentation for correctness, originality,
   organizational policies, and suitability for the internship assessment.
2. Verify all demo data, product descriptions, prices, screenshots, and
   deployment details before presenting them.
3. Run and retain the required tests in the final submission environment;
   distinguish mocked service tests from live MongoDB integration tests.
4. Confirm that no credentials, personal information, or secrets appear in
   reports, screenshots, commit history, or public deployment logs.
5. Add accurate author, candidate, registration, internship, and additional
   contributor details where placeholders remain.
6. Disclose any additional AI use not visible in the repository work history.

The test results recorded in
[`TEST-REPORT.md`](./TEST-REPORT.md) are the observed results from the
documented execution environment. They do not prove that the candidate
personally executed those tests or that the system was tested in production.

## 4. External libraries and licenses

The following are direct dependencies declared by the client and server
manifests. License identifiers below were read from installed package
metadata during report preparation; confirm against the exact lockfile/package
contents before a formal redistribution or legal review. Transitive
dependencies are not exhaustively listed here; the lockfiles and package
registries contain their license records.

| Package | Application use | License reported by installed metadata |
| --- | --- | --- |
| `axios` | Client HTTP requests | MIT |
| `lucide-react` | UI icons | ISC |
| `react`, `react-dom` | Client UI/runtime | MIT |
| `react-router-dom` | Client routing | MIT |
| `recharts` | Charts | MIT |
| `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` | Frontend lint tooling | MIT |
| `@tailwindcss/vite`, `tailwindcss`, `@vitejs/plugin-react`, `vite` | Frontend styling/build tooling | MIT |
| `@types/react`, `@types/react-dom` | Frontend type declarations | MIT |
| `bcryptjs` | Password hashing | BSD-3-Clause |
| `cors` | Cross-origin policy middleware | MIT |
| `dotenv` | Environment configuration loading | BSD-2-Clause |
| `express` | HTTP server framework | MIT |
| `express-rate-limit` | Authentication request rate limiting | MIT |
| `helmet` | HTTP security headers | MIT |
| `jsonwebtoken` | JWT signing and verification | MIT |
| `mongoose` | MongoDB object modeling | MIT |
| `morgan` | HTTP request logging | MIT |
| `swagger-ui-express` | OpenAPI UI | MIT |
| `zod` | Request/configuration validation | MIT |
| `jest`, `nodemon`, `supertest` | Backend testing/development | MIT |

Package-level license metadata does not establish a license for the
PharmaCare source code. The repository has no root `LICENSE` file; choose and
add a project license only after authorization from the project owner.

## 5. Third-party resources and attribution

- React, Vite, Express, MongoDB, Mongoose, Node.js, and OpenAPI documentation
  are linked from the project documentation for technical reference.
- Lucide React provides the icon components used by the UI; Recharts provides
  charting components.
- The seed catalog contains illustrative demonstration records. They are not
  medical advice and should not be used as verified pharmaceutical data.
- The repository includes `client/src/assets/hero.png`; its original source
  and attribution were not verified during this report preparation.
  **TODO:** Identify its creator/source and license, replace it with an
  appropriately licensed asset, or remove it if unused.
- **TODO:** Record the author and license for any additional images,
  illustrations, fonts, datasets, or copied external materials included by
  the project owner.



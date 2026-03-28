# MailSense Requirements

## 1. Overview

**Project:** MailSense  
**Type:** Internal implementation requirements  
**Not a PRD:** Yes

### Goal
Build a simple, cost-efficient internal web app to verify B2B marketing leads before exporting them to a separate email-sending system that uses AWS SES.

### Core Principle
Keep the system simple. Do not over-engineer.

### Business Context
- MailSense is only for **B2B marketing email verification**
- MailSense is **not** the email-sending app
- AWS SES belongs to a **separate project/app** and must remain decoupled
- Expected verification volume is approximately **500 emails/day**
- The system should reduce the risk of SMTP/IP blocking by avoiding aggressive verification behavior

---

## 2. Required Stack

### [P0] Mandatory Stack
- **Frontend:** SvelteKit
- **Backend:** Hono
- **Database:** SQLite
- **ORM:** Drizzle ORM
- **Auth:** Google OAuth
- **Deployment:** Railway
- **Verification Engine:** Reacher

### [P0] Platform Constraints
- Must deploy on **Railway**
- Must be compatible with **Railway scale-to-zero / serverless-style usage**
- Must be **cost efficient**
- Must avoid architecture that requires always-on services unless absolutely necessary

---

## 3. Product Scope

### [P0] Core Flow
1. User signs in with Google
2. User uploads lead files
3. System imports and stores rows
4. System verifies emails using Reacher
5. System categorizes results by status/risk
6. User reviews results in dashboard and tables
7. User exports clean results for use in a separate marketing app

### [P1] Secondary Flow
- User manually verifies a single email from a simple form

---

## 4. Functional Requirements

## 4.1 Authentication

### [P0]
- Implement Google OAuth login
- Only authenticated users can access the app
- Session handling must be production-ready and secure
- Keep auth simple
- Do not build complex org/workspace/role systems unless naturally trivial

---

## 4.2 File Import

### [P0] Supported Formats
- `.xlsx`
- `.csv`

### [P0] Import Capabilities
- User can upload files from the UI
- System parses rows safely
- Imported data is stored in the database
- System should preserve useful source values for traceability

### [P0] Import Feedback
Show:
- total rows detected
- rows accepted
- rows rejected
- rejection reason where possible

### [P0] Import Handling
Must handle:
- missing email column
- malformed emails
- duplicate rows
- duplicate emails across uploads
- basic column/header mapping or lightweight auto-detection

### [P2] Nice-to-have
- Preserve original row payload for debugging/audit purposes if easy to implement

---

## 4.3 File Export

### [P0] Supported Formats
- `.xlsx`
- `.csv`

### [P0] Export Capabilities
- User can export all results
- User can export filtered results
- Export must be usable in a separate marketing workflow

### [P0] Minimum Export Fields
- original email
- normalized email if available
- verification status
- risk level
- reason / notes
- verification timestamp

---

## 4.4 Single Email Verification

### [P0]
- Provide a simple input form for one email address
- Verify the email on submission
- Show result immediately in a clean format

### [P1]
- Optionally store single-email verification history for analytics

---

## 4.5 Bulk Verification

### [P0]
- User can trigger verification for imported rows
- Verification must be rate-limited and safe
- Progress must be visible in the UI

### [P0] Bulk Status States
At minimum:
- pending
- processing
- completed
- failed
- retryable if applicable

---

## 4.6 Result Categorization

### [P0]
After verification, each email must be categorized into clear buckets.

### [P0] Required Categories
Use practical categories such as:
- **Valid / likely safe**
- **Risky**
- **Invalid**
- **Unknown / inconclusive**

### [P0]
Store:
- primary verification status
- risk classification
- reason/details when available

### [P1]
- Add a confidence-style field if useful, but keep UI simple

---

## 4.7 Dashboard and Analytics

### [P0] Dashboard
Provide a clean dashboard with at least:
- total imported emails
- total verified
- valid count
- risky count
- invalid count
- unknown count
- recent uploads
- recent verification runs
- export-ready counts by category

### [P1] Useful Extras
- trend over time
- verification success rate
- domain-level breakdown
- duplicate rate
- top risky domains

### [P0]
The dashboard should look polished but stay implementation-light.

---

## 5. Verification Behavior

## 5.1 Reacher Usage

### [P0]
- Reacher must be used as the verification engine
- The integration pattern should be as simple as possible
- The system should not introduce unnecessary service boundaries unless truly helpful

---

## 5.2 B2B-Oriented Verification

### [P0]
The system is optimized for **business email lead verification**, not personal-email workflows.

### [P0]
Prioritize:
- domain-based B2B usefulness
- marketing list hygiene
- simple result interpretation for operational usage

---

## 5.3 Safe Throughput Design

### [P0]
Design around approximately **500 verifications/day**

### [P0]
The system must:
- throttle/rate-limit verification
- avoid aggressive parallelism
- avoid behavior likely to trigger provider blocking
- prefer safe pacing over maximum speed

### [P0]
The coding agent should choose sensible defaults for:
- concurrency
- pacing
- retries
- timeouts
- batch size

---

## 5.4 Retry Strategy

### [P0]
- Retries must be conservative
- Temporary failures must not trigger repeated aggressive probing
- Inconclusive results should remain classifiable as unknown/risky instead of forcing a false hard answer

---

## 6. Data Model Expectations

Keep the schema lean.

## 6.1 Users

### [P0]
Store only what is needed for auth/session:
- user id
- email
- name/basic profile fields if needed
- timestamps

---

## 6.2 Uploads / Import Jobs

### [P0]
Track:
- file name
- file type
- upload timestamp
- row counts
- import status
- import summary

---

## 6.3 Leads

### [P0]
Store:
- original email
- normalized email
- upload/import reference
- mapped fields if needed
- duplicate flag if useful

### [P1]
- original row payload if useful and low-effort

---

## 6.4 Verification Results

### [P0]
Store:
- lead reference
- status
- risk category
- reason/details
- verification timestamp

### [P1]
- lightweight raw response metadata if genuinely useful for debugging

---

## 6.5 Verification Runs / Batches

### [P0]
Track:
- batch/run status
- counts
- start time
- end time
- summary metrics

---

## 7. UX Requirements

## 7.1 General UX

### [P0]
- UI must be simple, clear, and modern
- Prioritize readability over visual complexity
- Avoid clutter
- Avoid building fancy UI for its own sake

---

## 7.2 Required Screens

### [P0]
- sign-in page
- dashboard
- import/upload page
- leads/results page
- single-email verify page

### [P1]
- simple settings/config page if needed

---

## 7.3 Results Table UX

### [P0]
Support:
- search
- filtering by status/risk
- sorting
- pagination or lazy loading
- quick export of filtered results

---

## 8. Deployment Requirements

## 8.1 Railway Deployment

### [P0]
- Must deploy cleanly on Railway
- Must remain cost-conscious
- Must support scale-to-zero friendly operation

### [P0]
Avoid:
- always-on polling loops
- always-on workers unless strongly justified
- architecture that prevents sleeping when idle

---

## 8.2 SQLite Persistence

### [P0]
- SQLite is required
- Database must persist across restarts and redeployments
- Migrations must be predictable and clean

---

## 8.3 Cost Efficiency

### [P0]
- Minimize idle resource use
- Prefer one deployable service unless splitting is clearly necessary
- Avoid extra infrastructure unless essential

---

## 9. Non-Functional Requirements

## 9.1 Simplicity

### [P0]
- Simplicity is the top architectural principle
- Prefer boring, maintainable defaults
- Avoid premature abstraction
- Avoid microservices unless clearly justified

---

## 9.2 Reliability

### [P0]
- Import failures must be understandable
- Verification failures must not corrupt data
- Partial progress should be recoverable where practical
- The system should fail gracefully

---

## 9.3 Security

### [P0]
- Secure auth flow
- Protect all app routes
- Validate uploads
- Sanitize user input
- Prevent obvious abuse of verification endpoints

---

## 9.4 Observability

### [P1]
Include lightweight observability:
- useful logs
- import summaries
- verification summaries
- actionable error messages

Do not build a full observability platform.

---

## 9.5 Performance

### [P1]
- Optimize for small internal usage
- No need for extreme-scale architecture
- Tables and dashboard should feel responsive for expected data size

---

## 10. Explicit Non-Goals

### [P0] Out of Scope
- Sending emails
- SES integration beyond exported-result compatibility
- CRM features
- lead enrichment
- billing/subscriptions
- team collaboration complexity
- multi-workspace enterprise roles
- advanced workflow automation
- massive-scale verification infrastructure
- proxy or IP-rotation systems
- overbuilt queue orchestration

---

## 11. Acceptance Criteria

### [P0] The implementation is acceptable when:
- user can sign in with Google
- user can import `.xlsx` and `.csv`
- imported rows are stored and visible
- user can verify a single email manually
- user can bulk verify imported emails
- results are categorized by risk/status
- user can view a dashboard with key analytics
- user can export results to `.xlsx` and `.csv`
- app deploys on Railway in a cost-conscious way
- app does not rely on always-on infrastructure unless strongly justified
- app remains simple and maintainable

---

## 12. Implementation Guidance

### [P0]
- Make pragmatic decisions without over-engineering
- Optimize for a simple internal tool, not a public SaaS platform
- Favor stable implementation over cleverness
- Favor safe verification pacing over speed
- Build only what is needed for the current use case

---

## 13. Implementation Guardrails

### [P0] Architecture Guardrails
- Do not split into multiple services unless there is a strong and specific reason
- Do not introduce Redis, message brokers, or background infrastructure unless clearly necessary
- Do not build a complex job orchestration system for this volume
- Do not design for future scale that does not exist yet

### [P0] Product Guardrails
- Do not mix email sending into MailSense
- Do not couple MailSense to AWS SES
- Do not add enrichment, CRM, or campaign features
- Do not turn this into a generic lead-management platform

### [P0] Verification Guardrails
- Do not optimize for maximum throughput
- Do not use aggressive concurrency or retry behavior
- Do not force binary valid/invalid output when results are inconclusive
- Prefer honest, practical categorization over fake precision

### [P0] UI Guardrails
- Do not overbuild the dashboard
- Do not add visual complexity that hurts usability
- Do not create too many screens or settings
- Keep operational workflows fast and clear

### [P0] Data Guardrails
- Keep the schema lean
- Store only what is useful
- Avoid excessive raw SMTP/debug payload storage unless clearly justified

### [P0] Deployment Guardrails
- Keep Railway costs low
- Preserve scale-to-zero friendliness
- Avoid always-awake patterns
- Keep deployment simple and predictable

### [P0] Engineering Guardrails
- Follow current official docs for framework/platform integrations
- Prefer straightforward implementation patterns
- Avoid hacks, workarounds, and speculative complexity unless absolutely required
- Any deviation from the required stack or architecture must be justified by a real blocker
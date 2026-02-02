### The Wolf Network - New PM Onboarding

This document equips a new PM to lead the Wolf Network app from day one: architecture, environments, integrations, operational runbooks, testing, and immediate priorities.

## Product overview
- **Purpose**: A members-only crisis relief hotline that connects a member to an operator and coordinates a vetted partner "pack" across Legal, Medical, PR, and Security.
- **MVP scope**: Invite-only auth, a long-press "Hotline" activation, Twilio voice bridging to an operator, lightweight incident tracking (Airtable), notifications (Discord), status pages, and a simple billing checkout.

## Architecture at a glance
- **Frontend/Backend**: Next.js App Router (React 19), TypeScript, TailwindCSS 4.
- **Auth**: NextAuth with Auth0 provider. Production access is invite/approval-gated via `INVITED_EMAILS` and/or Airtable `users.status`.
- **Middleware**: JWT gate + biometric cookie gate + optional LA geofence.
- **Data layer (MVP)**: Airtable for `users`, `incidents`, `codes`, and `operators` tables. Replace with Postgres/Prisma in v1.
- **Telephony**: Twilio REST API (no SDK) for outbound calls; TwiML endpoints for call bridging; webhook to track call status.
- **Payments**: Stripe Checkout for tier selection; a simple verification endpoint sets a `userTier` cookie (MVP stub).
- **Notifications**: Discord webhook for incident activation and resolution updates.
- **Analytics**: PostHog (optional; disabled if keys absent).
- **Caching/Rate limit**: Redis via `ioredis` (optional). In-memory fallback in dev.
- **PWA**: Config present; currently not emphasized in MVP.

## Codebase layout
- `src/app` - App Router pages and API routes
  - `api/auth/[...nextauth]` - NextAuth with Auth0 provider
  - `api/signup/*` - Invite and comped-code verification
  - `api/hotline/*` - Activate, TwiML, end-session
  - `api/twilio/*` - Voice/TwiML and status webhooks
  - `api/me/*` - Member identity, active session, security status, team
  - `api/incident/[incidentId]` - Incident status for public share/status pages
  - `api/billing/*` - Stripe checkout + verify (MVP cookie)
- `src/lib` - Env, crypto, rate limiting, Airtable access, twilio helpers, webhook verification, notifications
- `src/components` - UI components (e.g., `HotlineButton`)

## Environments and configuration
Prereqs: Node 20.x, npm.

Local dev
```bash
npm install
npm run dev
```

Testing and lint
```bash
npm test
npm run lint
```

Minimum env for local happy-path (place in `.env.local`):
- Auth0: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `NEXTAUTH_SECRET`
- Airtable (if using data features): `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`
- Twilio (for calling): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_OPERATOR_NUMBER`
- Base URL: `PUBLIC_BASE_URL` (helps Twilio callbacks/building absolute URLs in dev)

Helpful dev flags:
- `AUTH_DEV_BYPASS=true` - bypasses auth for select pages/APIs (see `middleware.ts`).
- `DEV_CALLER_E164=+15555550123` - fallback caller number when a user phone isn't configured.
- `BIOMETRIC_BYPASS_EMAILS=email@example.com,...` - allows biometric cookie bypass for listed addresses.
- `INVITED_EMAILS=email1@example.com,email2@example.com` - invite allow-list in production.

Optional/feature envs (set as needed):
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SILVER_ID`, `STRIPE_PRICE_GOLD_ID`, `STRIPE_PRICE_PLATINUM_ID`
- Redis: `REDIS_URL`
- Discord: `DISCORD_WEBHOOK_URL`
- PostHog: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Geofence: `LA_GEOFENCE_ENABLED=true`, `LA_GEOFENCE_CITY="Los Angeles"`
- Encryption key for PII-at-rest: `ENCRYPTION_KEY` (AES-256-GCM derivation)
- Auth0 Mgmt (signup email check): `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`, `AUTH0_MGMT_AUDIENCE`

Production guards
- In prod, `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` are enforced. `AUTH_DEV_BYPASS` and `DEV_CALLER_E164` must NOT be set.

## Critical flows
### 1) Authentication and gating
- NextAuth session is required by `middleware.ts` for most routes.
- Biometric gate uses a short-lived cookie `biometric_ok=1` (WebAuthn placeholder); required to access protected UI.
- Optional LA geofence redirects outside city to `/blocked?reason=geo`.

### 2) Signup and access
- Invite request: `POST /api/signup/request-access` stores email/phone (encrypted) and status `pending` in Airtable.
- Comped code: `POST /api/signup/comped-verify` validates against `codes` table, upserts user as `approved`, and drives Auth0 sign-in vs sign-up.
- Production sign-in requires either invited email (`INVITED_EMAILS`) or Airtable `users.status` ∈ {`approved`, `active`}.

### 3) Hotline activation (end-to-end)
1. UI long-press triggers `POST /api/hotline/activate`.
2. Server resolves the member's callable number:
   - Decrypts `users.phoneEncrypted` when present; else checks assigned Twilio/alias fields; else dev fallbacks.
3. Creates an `incidents` record (Airtable) with `status=initiated` and optional operator assignment.
4. Initiates Twilio call via REST to member, TwiML at `/api/twilio/voice` or `/api/hotline/twiml` bridges to operator.
5. Twilio status webhooks `POST /api/twilio/call-status` update incident to `active`, then a terminal state (e.g., `resolved`, `missed`, `abandoned`).
6. Discord notifications are sent on activation and resolution.

Manual end: `POST /api/hotline/end-session` ends a call (best-effort) and resolves the incident (`resolved` if operator attached, else `pending_followup`).

### 4) Status and presence
- Member status: `GET /api/me/active-session` returns derived activity + Twilio status/duration.
- Public/Sharable incident: `GET /api/incident/[incidentId]` returns a minimal, non-PII summary.
- Partner presence: `GET /api/partners/presence` returns a deterministic, time-varying mock by region.

## Data model (Airtable)
- `users` - `id`, `email`, `wolfId`, `phoneEncrypted`, `status` (`pending|approved|active`), `tier`, `region`, optional assigned numbers.
- `incidents` - `id` (UUID or Airtable `rec...`), `wolfId`, `sessionSid`, `status`, `type`, `partnerId`, `operatorId`, `createdAt`, `resolvedAt`, `tier`, `region`, `callSid`, `activatedAt`, `statusReason`, `twilioStatus`, `durationSeconds`, `operatorPhone`.
- `codes` - `code`, `wolfId?`, `tier?`, `disabled?`.
- `operators` - `id`, `phone`, `region`, `status` (`available`).

Note: The server tolerates common case variations in Airtable field/table names where practical.

## Security and privacy
- Phone numbers stored at rest as `phoneEncrypted` using AES-256-GCM with a derived key from `ENCRYPTION_KEY`.
- Middleware prevents access without session, biometric cookie, and (optionally) within geofence.
- Webhooks: Twilio signature verification enforced in production for `/api/twilio/call-status`.
- Client pages may use `localStorage` for UI placeholders; avoid persisting PII in browsers post-MVP.

## Operational runbooks
### Hotline incident lifecycle
- If calls fail to initiate: check Twilio env, `PUBLIC_BASE_URL`, and Twilio Console logs; see `createDirectCall`.
- If incidents don't update: verify Twilio webhooks point to `/api/twilio/call-status` and signature settings, confirm Airtable availability.
- If status hangs at `initiated`: `GET /api/me/active-session` prunes stale incidents >30m; else resolve manually via `end-session`.

### Twilio outages or misconfig
- Fail closed: members see "idle" or error. Flip to dev fallback for internal testing: set `AUTH_DEV_BYPASS=true` and `DEV_CALLER_E164`.
- Temporarily disable hotline button in UI (feature flag) if needed.

### Airtable unavailable
- Rate-limit endpoints continue (in-memory fallback). Data writes fail. Communicate partial outage; queue changes client-side where safe; retry later.

### Discord webhook failures
- Logged as warnings; do not block user flows. Rotate `DISCORD_WEBHOOK_URL` or disable temporarily.

### Rate limiting
- Redis is preferred; without Redis we fall back to in-memory limiting per instance.
- Adjust per-route max/mins in `src/lib/rateLimit.ts` callers.

### Geofence and biometric gates
- Geofence: toggle `LA_GEOFENCE_ENABLED`. City is matched via `x-vercel-ip-city`/edge `req.geo?.city`.
- Biometric: placeholder flow sets a short-lived cookie; treat as product debt until real WebAuthn is enabled.

## Deployment and environments
- Recommended: Vercel or Node host with HTTPS and static IP-friendly DNS for Twilio webhooks.
- Ensure `PUBLIC_BASE_URL` is set to the external HTTPS URL.
- Configure Twilio webhooks:
  - Voice/TwiML: `GET/POST {PUBLIC_BASE_URL}/api/twilio/voice` or `{PUBLIC_BASE_URL}/api/hotline/twiml`
  - Status callback: `POST {PUBLIC_BASE_URL}/api/twilio/call-status`
- Configure Auth0 Application (regular web app) and callback URLs via NextAuth defaults.
- Stripe: create Prices, set `STRIPE_SECRET_KEY` and price IDs.
- Redis: optional for production-grade rate limiting.

## QA and release checklist
Functional smoke tests
- Auth: invite-only sign-in works; blocked for non-invited in prod.
- Biometric gate: protected pages redirect to `/biometric` without cookie; success sets `biometric_ok`.
- Hotline: activation creates an incident, dials member, bridges to operator, updates statuses, resolves properly.
- Webhooks: Twilio status updates mutate incidents; signature required in prod.
- Status pages render incident summaries and member live status.
- Billing: Stripe Checkout flow returns and sets `userTier` via verify endpoint.

Non-functional
- Rate limits enforced (429) on spammy endpoints (hotline, signup, phone update).
- Logs and Discord notifications fire on activation and resolution.
- Geofence blocks outside LA when enabled.

Release checklist
- Secrets present in target env (Auth0, Airtable, Twilio, Stripe, `PUBLIC_BASE_URL`).
- Twilio webhooks updated to match deployment URL.
- `AUTH_DEV_BYPASS` and test fallbacks disabled in production.
- PostHog keys configured (optional) or omitted safely.
- Basic runbook validated (place a test call, verify Discord, confirm status pages).

## Known gaps and immediate priorities
- Replace Airtable with Postgres/Prisma; formalize schema and migrations.
- Implement real WebAuthn for biometric step; remove client `localStorage` PII.
- Hardening: stricter input validation, observability (metrics, tracing), and error budgets.
- Operator dispatch: real-time availability, queueing, and escalation policy beyond placeholders.
- Payments: server-side verification of Stripe sessions; entitlements enforcement.
- E2E tests for hotline and webhook flows; staging environment with Twilio test harness.

## Key files to know
```12:98:src/middleware.ts
// Auth, biometric cookie, geofence; dev bypass logic and route matcher
```
```15:241:src/app/api/hotline/activate/route.ts
// Activation endpoint: user lookup, incident create, Twilio call initiation, side-effects
```
```16:99:src/app/api/twilio/call-status/route.ts
// Twilio status webhook → maps call states to incident updates/resolution
```
```1:99:src/lib/db.ts
// Airtable access helpers: users, incidents, codes; create/update/find
```
```1:68:src/lib/incidents.ts
// Active incident queries, presence mock, and centralized resolveIncident
```

## How to lead from day one
- Confirm production secrets and Twilio webhooks match `PUBLIC_BASE_URL`.
- Run a full hotline lifecycle test (activate → connect → resolve → Discord).
- Review Airtable base for table names/fields; align with the above data model.
- Align security posture: disable dev bypasses, verify signature checks, rotate `ENCRYPTION_KEY` per environment.
- Prioritize the "Known gaps" list and convert into roadmap epics with owners and timelines.

---

## V2 Updates (2026-02-01)

### Simplified UX (`/hotline-v2`)
The new V2 hotline page reduces activation from 6 steps to 3:
1. Tap crisis type (Legal/Medical/Security/PR)
2. Hold button (1.5s with visual progress)
3. Connected to specialist

Key files:
- `src/components/CrisisSelector.tsx` — Category selection + hold-to-activate
- `src/app/hotline-v2/page.tsx` — Simplified page with live status

### Crisis Type Routing
The API now accepts and routes by crisis type:

```typescript
POST /api/hotline/activate
{ "crisisType": "legal" | "medical" | "security" | "pr" }
```

- Stored on incident record as `type`
- Operator lookup filters by `specialty` field when available
- Discord notifications display crisis type with emoji

### Airtable Schema Updates
Operators table can now include:
- `specialty`: "legal" | "medical" | "security" | "pr"

Operators with matching specialty are prioritized; fallback to any available.

### Navigation
Bottom nav now routes to `/hotline-v2` by default. Home page retains legacy quick-activate for emergencies.

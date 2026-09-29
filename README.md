# ProofPay

ProofPay turns field media into milestone evidence, gives each verification an audit trail, and releases a **simulated** escrow allocation when the trust threshold is met. Real payouts are intentionally not connected.

## Local setup

Requirements: Node.js 20+ and Docker Desktop with the Linux engine running. Cloudinary and Gemini credentials are optional integrations.

```powershell
Copy-Item .env.example .env
docker compose up -d --build
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create the first account (it becomes `FUNDER` for its workspace), then create a project, fund simulated escrow, and allocate a milestone. Add other users by email after they register. Assign a reviewer to enable independent milestone decisions.

## React Native field app

The Expo app lives in `apps/mobile` and uses the same API, database, organization memberships, and server-side role checks as the web workspace. It supports secure sign-in, project and milestone views, reviewer decisions, and private evidence-photo uploads.

```powershell
cd apps/mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` to the API address reachable from the device. For a physical phone, use the computer's LAN IP (for example `http://192.168.1.20:3000`); Android emulators commonly reach the host at `http://10.0.2.2:3000`. `localhost` works for iOS Simulator and local web development. The native app stores its revocable bearer session in Expo SecureStore; the server accepts that token through the same API middleware used by web cookie sessions.

## Service configuration

By default, images are persisted on the app host under the ignored `.proofpay/` directory; originals are never served without workspace membership. This lets the full upload→review flow run locally with no vendor account. Set all of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env` to use authenticated Cloudinary storage instead. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) for vision analysis. Without Gemini, media is still stored with server-computed SHA-256, EXIF and image fingerprint; ProofPay leaves the trust score at zero and requires a human reviewer rather than fabricating analysis. Configure a durable shared object store and worker queue before running multiple app replicas.

PostgreSQL 16 is built from PostGIS and pgvector. Redis runs locally for the planned worker pipeline; upload analysis currently runs synchronously in the Next.js route.

## Implemented flows

- Scrypt password hashes and random, hashed, revocable session tokens in HttpOnly cookies.
- Workspace memberships and role checks: `FUNDER`, `NGO_ADMIN`, `FIELD_WORKER`, `REVIEWER`, `AUDITOR`.
- Database-backed projects, milestone budgets, private original uploads, analysis checks, public ledger previews, and audit records.
- Project funding is a double-entry **simulation** ledger operation. Milestone allocation moves available escrow to a held account. A qualifying verdict releases the hold once with a unique idempotency key.
- Trust scoring is deterministic and explainable: visual relevance, a 64-bit difference-hash duplicate fingerprint, geofence distance, capture time, metadata integrity, and image validity. Gemini provides visual relevance/caption only; GPS/time/hash checks are computed independently. Image blur/exposure analysis is not wired yet, so that score uses an explicitly neutral weight.
- A reviewer can record a reasoned override. Every funding, project change, evidence upload, role assignment, and milestone decision is audited.
- Public ledgers expose only verified claims and signed Cloudinary previews, and only after the funder enables public access.

## APIs

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`
- `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/:projectId`
- `POST /api/projects/:projectId/fund`, `GET|POST /api/projects/:projectId/milestones`
- `GET|POST /api/projects/:projectId/assets`, `GET /api/projects/:projectId/audit`
- `POST /api/milestones/:milestoneId/decision`
- `GET|POST /api/organizations/:organizationId/members`
- `GET /api/ledger/:projectId` (public projects only)
- `GET /api/health`

## Limits and safety

The current upload flow accepts JPEG, PNG, and WebP up to 12 MB. Video, voice, WhatsApp ingestion, BullMQ workers, vector semantic search, PDF/reel generation, and real banking payouts are not wired yet. The in-process vision call has a 45-second timeout; move analysis to the worker queue before production scale. Simulated ledger records are not legal escrow and do not move money.

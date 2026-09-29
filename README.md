# ProofPay

**Funds move when the ground proves it.** ProofPay turns field submissions into traceable milestone evidence and a transparent simulated release ledger.

## Run locally

Requirements: Node.js 20+ and Docker Desktop. The PostgreSQL image is built from PostGIS and installs pgvector.

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard opens with a seeded watershed project and works in demo mode without third-party credentials. Docker starts PostgreSQL 16 with PostGIS/pgvector and Redis 7.

## Optional Cloudinary uploads

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env`. Request `POST /api/media/signature` with `{ "projectId": "…", "milestoneId": "…" }`, then upload directly from the browser to the returned Cloudinary URL with the returned signed parameters. Originals should stay private; public views should use derived, signed delivery URLs.

## API

- `GET /api/health` — web, database and Cloudinary configuration status.
- `GET /api/projects` — projects with milestones and asset counts.
- `POST /api/projects` — validate and create a project (`name`, `description`, `location`, `budget`).
- `POST /api/media/signature` — create a short-lived signed upload payload for a project milestone.

## Scope and demo behavior

The UI's seeded evidence, trust explanations, approval controls and ledger are demo data. Approval is labeled **Simulation mode** and does not move real money. Real Cloudinary ingestion, Gemini analysis, Twilio WhatsApp, worker queues, and background verification still require credentials and pipeline wiring. The Postgres schema includes projects, milestones, assets, evidence links and idempotent double-entry ledger records; `infra/init.sql` enables spatial and vector extensions.

## Useful commands

```powershell
npm run dev
npm run build
npx prisma studio
docker compose down
```

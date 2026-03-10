# Convertix

Convertix is a media processing platform for authenticated users to upload videos/images, run FFmpeg transformations, and receive real-time job updates.

It is built as a Turborepo monorepo with:
- a React web app (`apps/web`)
- an Express API (`apps/api`)
- a Bull/Redis worker (`apps/worker`)
- PostgreSQL for metadata, sessions, billing ledger, and outbox events
- RabbitMQ for durable event delivery

## What the app does

### Video features
- Upload video (`mp4`, `mov`) with streaming validation
- Auto-generate thumbnail on upload
- Resize video (queued)
- Convert video format (queued): `mp4`, `mov`, `avi`, `webm`, `mkv`, `flv`
- Extract audio to AAC (synchronous)

### Image features
- Upload images (`jpg`, `jpeg`, `png`, `gif`, `webp`) with streaming validation
- Crop image (queued)
- Resize image (queued)
- Convert image format (queued)

### Platform features
- Session auth with HttpOnly cookie token
- Admin endpoints for user management and platform analytics
- Credit-based billing with reservation/capture/refund flow
- Durable outbox for side effects (`outbox_events` + dispatcher)
- WebSocket updates for job lifecycle and progress
- OpenTelemetry hooks for API/worker/queue/FFmpeg instrumentation

## Architecture

1. Web UI calls `/api/*` and subscribes to `/socket.io/*`.
2. API validates request, records operation + credit reservation in PostgreSQL transaction.
3. Worker picks up queued jobs from Bull (Redis), runs FFmpeg, updates operation state.
4. Billing reservation is captured on success or released on terminal failure.
5. Outbox dispatcher publishes durable events to RabbitMQ.
6. Socket handler broadcasts events/progress to subscribed clients.

## Monorepo layout

```text
convertix/
  apps/
    api/       Express API + Socket.IO + outbox dispatcher
    worker/    Bull queue processors + maintenance jobs
    web/       React + Vite frontend
  packages/
    shared/    shared config, db services, telemetry, event bus, outbox repo
    database/  schema and SQL migrations
  scripts/     utility/migration/verification scripts
```

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3+
- FFmpeg available in PATH

## Quick start (Docker)

```bash
npm install
npm run docker:build
npm run docker:up
```

Access:
- Web: `http://localhost:5173`
- API health: `http://localhost:3000/health`
- RabbitMQ UI: `http://localhost:15672`

Logs:
```bash
npm run docker:logs
```

Stop:
```bash
npm run docker:down
```

Clean volumes:
```bash
npm run docker:clean
```

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Create database and load base schema

```bash
createdb video_editor
psql video_editor < packages/database/schema.sql
```

### 3. Apply required migrations

Run these in order:

```bash
node packages/database/run-migration.js 003_billing_hardening.sql
node packages/database/run-migration.js 004_billing_state_guards.sql
node packages/database/run-migration.js 005_add_recon_type.sql
node packages/database/run-migration.js 006_create_outbox.sql
```

If your DB was initialized from an older snapshot, also run:

```bash
node scripts/saas-migration.js
```

### 4. Configure environment

```bash
cp .env.example .env
```

Minimum values to verify in `.env`:
- `API_PORT=3000`
- `CORS_ORIGIN=http://localhost:5173`
- `DB_*`, `REDIS_*`, `RABBITMQ_URL`
- `QUEUE_CONCURRENCY=5`

For Stripe flows, also set:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL` (for checkout success/cancel redirects)

### 5. Start services

```bash
npm run dev
```

Or run individually:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```

## Seed data

Root seed (basic sample users/media):
```bash
npm run seed
```

Admin analytics seed (dashboard-oriented):
```bash
node apps/api/scripts/seed-admin.js
```

`seed-admin.js` logins:
- `admin_enterprise / password123`
- `testuser / password123`

## API overview

All state-changing endpoints require header:
- `X-CSRF-Protection: 1`

Many state-changing requests support idempotency via:
- `X-Request-ID: <unique-id>`

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/user`
- `PUT /api/auth/user`

### Video
- `GET /api/videos`
- `POST /api/videos/upload`
- `POST /api/videos/resize`
- `POST /api/videos/convert`
- `POST /api/videos/extract-audio`
- `GET /api/videos/asset`

### Image
- `GET /api/images`
- `POST /api/images/upload`
- `POST /api/images/crop`
- `POST /api/images/resize`
- `POST /api/images/convert`
- `GET /api/images/asset`

### Billing
- `GET /api/billing/transactions`
- `POST /api/billing/buy-credits`
- `POST /api/billing/upgrade`

### Payments
- `POST /api/payments/create-session`
- `POST /api/payments/create-upgrade-session`
- `POST /api/payments/webhook`

### Admin
- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `GET /api/admin/stats`

## WebSocket events

Client subscribes by resource ID (videoId/imageId):
- `subscribe`
- `unsubscribe`

Events emitted to clients:
- `job:queued`
- `job:started`
- `job:progress`
- `job:completed`
- `job:failed`

## Billing model (current behavior)

- New users start with 10 credits.
- Processing operations reserve 1 credit at submission.
- On success: reservation is captured (`debit_capture`, amount 0 marker).
- On terminal failure: reservation is refunded.
- Ledger rows are protected by DB constraints/triggers from migration `004_billing_state_guards.sql`.

## Reliability mechanisms

- Transactional operation creation + credit reservation
- Durable outbox table (`outbox_events`) with polling dispatcher
- `SKIP LOCKED` claiming for multi-instance outbox dispatch
- Bull retries with exponential backoff
- Startup restoration of pending operations in worker
- Reservation janitor and storage cleanup background tasks in worker

## Useful scripts

- `apps/api/scripts/reconciliation.js` - ledger vs balance check/explain/repair
- `scripts/test-reservation-lifecycle.js` - reservation lifecycle verification
- `scripts/test-billing-idempotency.js` - idempotency validation
- `scripts/test-reconciliation.js` - reconciliation checks
- `scripts/apply-outbox.js` - outbox migration utility

## License

ISC

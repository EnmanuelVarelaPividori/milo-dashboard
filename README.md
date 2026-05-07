# milo-dashboard

Minimal Node.js + TypeScript + Fastify + PostgreSQL bootstrap for Milo job tracking.

## Stack

- Node.js 24
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- Vitest

## Local setup

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npm run db:up
npm run prisma:dev
npm run dev
```

If your host does not have `docker compose`, install Docker Compose first or start PostgreSQL manually.

## Scripts

- `npm run dev` — dev server
- `npm test` — tests
- `npm run lint` — typecheck
- `npm run build` — production build
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:dev` — create/apply local migrations
- `npm run prisma:migrate` — deploy migrations
- `npm run db:up` — start PostgreSQL with Docker Compose
- `npm run db:down` — stop PostgreSQL with Docker Compose

## Endpoints

- `GET /` — service info
- `GET /health` — basic health
- `GET /ready` — readiness check against PostgreSQL

## Database

Current tables:

- `jobs`
- `job_runs`
- `ticket_runs`

Initial migration is in `prisma/migrations/20260507000000_init`.

## CI/CD

GitHub Actions workflow:

- runs install + Prisma generate + typecheck + tests + build on pushes/PRs
- deploys on tags matching `v*`

### Required GitHub Secrets for deploy

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

The deploy step copies the repo to the server and runs Docker Compose there.

# milo-dashboard

Getting-started base project for Milo.

## Stack

- Node.js 24
- TypeScript
- Fastify
- PostgreSQL
- pg
- Vitest

## What is included

- minimal Fastify server
- `.env.example`
- Dockerfile
- `docker-compose.yml` with PostgreSQL
- GitHub Actions CI/CD
- health and readiness endpoints
- simple SQL migrations runner
- Discord OAuth login scaffold with whitelist + roles (`admin`, `developer`)
- protected web chat UI scaffold (`/chat`)

## GitHub PAT

If you want to use a Personal Access Token locally for Git operations, create:

```bash
cp .env.github.example .env.github
```

Then fill:
- `GITHUB_USERNAME`
- `GITHUB_PAT`
- `GITHUB_REPO`

Keep `.env.github` local only.

## Local setup

```bash
cp .env.example .env
npm ci
npm run dev
```

If you want PostgreSQL locally with Docker:

```bash
npm run db:up
npm run migrate:dev
```

For the current getting-started deploy, `docker-compose.yml` does not require a checked-in `.env` file on the server.

## Scripts

- `npm run dev`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run db:up`
- `npm run db:down`
- `npm run migrate:dev`
- `npm run migrate`

## Endpoints

- `GET /`
- `GET /login`
- `GET /chat`
- `GET /auth/discord/login`
- `GET /auth/discord/callback`
- `GET /health`
- `GET /ready`
- `GET /api/me`
- `POST /api/chat`

## Discord OAuth config

Set these env vars:

- `BASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`
- `DISCORD_ADMIN_IDS`
- `DISCORD_DEVELOPER_IDS`

Suggested Discord OAuth callback URL:

- `<BASE_URL>/auth/discord/callback`

Whitelist/roles work by Discord user ID:

- IDs in `DISCORD_ADMIN_IDS` => `admin`
- IDs in `DISCORD_DEVELOPER_IDS` => `developer`

## Database and migrations

Migrations live in `migrations/*.sql` and are applied through `src/scripts/migrate.ts`.

Current initial migration creates:
- `schema_migrations`
- `jobs`
- `job_runs`
- `ticket_runs`

## CI/CD

The workflow:
- runs install
- runs typecheck
- runs tests
- runs build
- deploys on tags `v*`
- app container applies migrations on startup before serving traffic

### Required GitHub Secrets for deploy

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

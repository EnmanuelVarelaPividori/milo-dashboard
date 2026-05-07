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
```

## Scripts

- `npm run dev`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run db:up`
- `npm run db:down`

## Endpoints

- `GET /`
- `GET /health`
- `GET /ready`

## CI/CD

The workflow:
- runs install
- runs typecheck
- runs tests
- runs build
- deploys on tags `v*`

### Required GitHub Secrets for deploy

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

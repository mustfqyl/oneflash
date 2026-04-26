# oneflash

Next.js 16 App Router application for unified Google Drive and OneDrive management.

## Local verification

```bash
npm run env:check
npm run lint
npm run test
npm run build
```

## Required environment

Start from [.env.example](./.env.example) and configure at least:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ROOT_DOMAIN`
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `ENCRYPTION_KEY`
- `ADMIN_EMAILS` or `ADMIN_EMAIL`

Optional integrations must be configured as complete pairs:

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Microsoft OAuth: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Vercel integration: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`

## Docker / VPS

The project now builds with Next.js standalone output for container deployment.

```bash
docker compose build
docker compose up -d
```

For a one-command VPS install on Ubuntu/Debian, run:

```bash
chmod +x install.sh
./install.sh
```

What the installer does:

- asks for the root domain, admin emails, database mode, Cloudflare token, and optional integrations
- generates production env files under `deploy/runtime/`
- creates or updates the apex and wildcard DNS records in Cloudflare
- provisions Docker if needed
- boots Traefik with automatic Let's Encrypt wildcard TLS
- bootstraps Prisma schema and starts the app stack

Notes:

- The fully automatic flow assumes the domain is managed in Cloudflare because the app needs `*.root-domain` routing plus wildcard TLS.
- If `prisma/migrations/` is empty, the installer uses `prisma db push --skip-generate` for first-time schema bootstrap.

Runtime behavior:

- Container startup validates critical environment variables before booting Next.js.
- `GET /api/health` returns `200` only when both env config and database connectivity are healthy.
- The image runs as a non-root user and exposes port `3000`.

## Deployment notes

- Put nginx or another reverse proxy in front of the app for TLS, request size limits, buffering control, and rate limiting.
- Keep `ROOT_DOMAIN` and `NEXT_PUBLIC_ROOT_DOMAIN` identical so subdomain routing behaves consistently on server and client.
- If you deploy multiple app instances, also set `DEPLOYMENT_VERSION` during rollout so Next.js can detect version skew.

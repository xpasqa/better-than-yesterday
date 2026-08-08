# E2E Tests (Playwright)

End-to-end tests for Better Than Yesterday. They run against a real Postgres
database and a real API — no mocks.

## Prerequisites

1. **Postgres running:**
   ```bash
   docker compose up -d postgres
   ```

2. **Environment variables** — the `.env` file must be present at the repo
   root (it is a symlink to the main repo's `.env`). Required vars:
   - `DATABASE_URL` — points at the Postgres instance above
   - `SESSION_SECRET` — used by the API for session signing
   - `APP_ENCRYPTION_KEY` — used by the API for field encryption

   These are never committed; see `.env.example` for the required keys.

## Running the tests

```bash
# Run all e2e tests (starts API + web dev servers automatically)
npm run test:e2e

# Open the interactive Playwright UI
npm run test:e2e:ui
```

The `webServer` config in `playwright.config.ts` starts both servers
automatically before the suite and shuts them down afterwards. If they are
already running (e.g. you have `npm run dev` open), Playwright reuses them.

## How test users work

Each test file creates its own user via `npm run user -- add <email>` and
logs in through the UI. Users are created in the real database, so:

- **Running the suite twice** is safe — the fixture detects duplicate emails
  and skips re-creation.
- **Cleaning up** test users is not automated; they remain in the DB. This
  is intentional: test data is cheap and cleanup logic is a maintenance
  burden.

## Selectors

All selectors use `getByRole` / `getByLabel`. No CSS class selectors.

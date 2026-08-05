import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs standalone, outside the app's own bootstrap, so it can't
// go through src/config.ts's single parse-env-once path. Loaded by absolute
// path (not cwd) so `drizzle-kit generate` works the same whether it's run
// from the repo root or from apps/api. Missing in CI/production on purpose:
// the real env vars are already set there.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
try {
  process.loadEnvFile(`${repoRoot}.env`)
} catch {
  // no .env present — fine, the variables are expected to be set already
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})

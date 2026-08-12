// Runs once per test file, before that file's own imports evaluate — so
// setting DATABASE_URL here, before anything imports db/client.ts (which
// reads it at module-load time), points every test at the dedicated test
// database instead of dev data.
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
try {
  process.loadEnvFile(`${repoRoot}.env`)
} catch {
  // no .env — CI is expected to set real env vars directly
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:55432/better_test'

// VAPID keys are required by config.ts but unused in tests — provide dummy
// values so the config validator doesn't abort the process before any test runs.
process.env.VAPID_PUBLIC_KEY ??= 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAc'
process.env.VAPID_PRIVATE_KEY ??= 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
process.env.VAPID_SUBJECT ??= 'mailto:test@example.com'

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

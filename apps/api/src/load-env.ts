// Loads the repo-root .env by an absolute path derived from this file's own
// location — not by cwd — so `tsx src/index.ts`, `npm run dev -w
// @better/api`, and `npm run db:migrate` from the repo root all find the
// same file regardless of where the command was invoked from. Missing in
// production on purpose: real env vars are already set there.
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

try {
  process.loadEnvFile(`${repoRoot}.env`)
} catch {
  // no .env file — fine in production
}

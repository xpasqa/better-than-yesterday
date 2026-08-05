// Split out from routes.ts so the CLI (scripts/user.ts) can hash a password
// without importing Hono route registration along with it.
import { hash } from '@node-rs/argon2'

// No explicit algorithm option: @node-rs/argon2 defaults to Argon2id, and
// verify() reads the algorithm/version/cost params back out of the hash
// string itself, so there is nothing to keep in sync between the two calls.
export async function hashPassword(password: string): Promise<string> {
  return hash(password)
}

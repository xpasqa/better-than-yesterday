// Parses environment variables ONCE, here, with Zod — the only file in this
// app allowed to read `process.env` (infra spec §3.3). A missing or
// malformed variable kills the process at boot with a message naming it,
// rather than surfacing as a confusing failure three requests later.
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  APP_ENCRYPTION_KEY: z.string().min(32, 'APP_ENCRYPTION_KEY must be at least 32 characters').optional(),
})

function loadConfig() {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    console.error(`Invalid environment configuration:\n${issues}`)
    process.exit(1)
  }
  return parsed.data
}

export const config = loadConfig()

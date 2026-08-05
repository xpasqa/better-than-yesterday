// One-shot migration runner — also called at container start (infra spec
// §7) so a deploy never needs a manual migrate step.
import '../load-env.ts'

const { drizzle } = await import('drizzle-orm/postgres-js')
const { migrate } = await import('drizzle-orm/postgres-js/migrator')
const { default: postgres } = await import('postgres')
const { config } = await import('../config.ts')

const migrationClient = postgres(config.DATABASE_URL, { max: 1 })
await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' })
await migrationClient.end()
console.log('Migrations applied.')

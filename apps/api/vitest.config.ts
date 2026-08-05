import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    // Integration tests share one real Postgres connection pool and must
    // not truncate tables out from under each other.
    fileParallelism: false,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend Hono jalan di :3001 saat dev; produksi nginx mem-proxy prefix ini ke
// api:3001. Configurable via DEV_API_PORT so e2e (playwright.config.ts) can
// point its own ephemeral API instance at a free port when 3001 is already
// taken by something unrelated on the host.
const apiPort = process.env.DEV_API_PORT ?? '3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    strictPort: false, // auto naik ke port berikutnya kalau 4200 dipakai
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
      '/auth': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
      '/health': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    strictPort: false, // auto naik ke port berikutnya kalau 4200 dipakai
    proxy: {
      // Backend Hono jalan di :3001 saat dev; produksi disatukan lewat Caddy.
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})

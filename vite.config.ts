import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned so the site and dashboard never fight over a port, and so the
  // backend's CORS_ORIGINS can name both with certainty.
  server: {
    port: 5173,
    strictPort: true,
  },
})

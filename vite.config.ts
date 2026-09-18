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
  build: {
    // Every browser this site supports has had these for years; targeting them
    // directly means no async/await or spread down-levelling, which is both
    // less code to ship and less work to run.
    target: 'es2022',
    // The default 500 kB warning existed to flag the three.js chunk, which is
    // gone; nothing here should approach it now, so keep the alarm tight.
    chunkSizeWarningLimit: 400,
  },
})

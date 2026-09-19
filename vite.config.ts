import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Vite inlines env vars at build time. Without VITE_API_BASE_URL the client
  // falls back to a relative "/api", so the deployed site calls its own static
  // host: content silently falls back to the built-in copy and every form POST
  // comes back 405. Fail the build rather than ship that.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '')
    if (!env.VITE_API_BASE_URL?.trim()) {
      throw new Error(
        'VITE_API_BASE_URL is not set.\n' +
          'The site needs the kf_backend origin baked in at build time, e.g.\n' +
          '  VITE_API_BASE_URL=https://kf-backend.onrender.com\n' +
          'On Vercel: Settings -> Environment Variables, then redeploy (changing it\n' +
          'without a redeploy has no effect, because the value is compiled in).',
      )
    }
  }

  return {
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
  }
})

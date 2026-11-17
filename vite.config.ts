import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend (order-integration-platform) runs on 9091. In development every /api call is
// proxied there, so the browser sees one origin and the backend needs no CORS rules.
const backend = process.env.ORDER_PLATFORM_API ?? 'http://localhost:9091'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      // The shop's GraphQL catalogue, and the page to try queries
      '/graphql': { target: backend, changeOrigin: false },
      '/graphiql': { target: backend, changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/graphql': { target: backend, changeOrigin: false },
    },
  },
  build: {
    sourcemap: true,
  },
})

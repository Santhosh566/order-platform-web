import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Tests read the backend's GraphQL schema (../order-integration-platform), to check the queries
    server: { fs: { allow: ['..'] } },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // Playwright's tests in e2e/ run against a live stack with `npm run e2e`
      include: ['src/**/*.test.{ts,tsx}'],
      testTimeout: 20_000,
    },
  }),
)

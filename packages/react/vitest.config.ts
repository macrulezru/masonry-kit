import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Aliases straight to core's source (not its built dist/) so a core
    // change is visible to these tests immediately, without a
    // `pnpm --filter=./packages/core run build` in between — the Vue
    // package's tests don't have this (workspace `dist/` linkage), which
    // has bitten this repo's own development twice already.
    alias: {
      '@macrulez/masonry-kit-core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
  },
})

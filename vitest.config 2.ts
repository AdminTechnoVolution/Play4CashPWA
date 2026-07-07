import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __APP_GIT_SHA__: JSON.stringify('testsha'),
    __APP_FULL_VERSION__: JSON.stringify('0.0.0-test+testsha'),
    __APP_BUILD_TIME__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
  resolve: {
    alias: {
      // `virtual:pwa-register/react` is provided at build time by vite-plugin-pwa.
      // In tests we substitute a hand-rolled stub so specs can `vi.mock` it freely.
      'virtual:pwa-register/react': path.resolve(
        __dirname,
        'test/stubs/pwa-register-react.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/pwa/**/*.ts', 'src/pwa/**/*.tsx'],
    },
  },
});

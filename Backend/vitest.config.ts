import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'src/__tests__/api.postgres.*.test.ts'],
    isolate: true,
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'false' },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});

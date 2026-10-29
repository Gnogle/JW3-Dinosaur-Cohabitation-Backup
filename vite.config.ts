import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the project under /<repository>/. GITHUB_ACTIONS is set by Actions runners only,
// so local dev and tests keep serving from /.
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

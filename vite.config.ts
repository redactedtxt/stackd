/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The tested code is pure TypeScript (simulation, indicators, backtester,
    // analytics) — no DOM needed, so the fast Node environment is enough.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

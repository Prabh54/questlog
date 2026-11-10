import { defineConfig } from 'tsup';

// Dual build: the API runs as CommonJS (ts-node / Jest), the web app as ESM (Vite).
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
});

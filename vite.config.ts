import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.fbx'],
  server: { port: 5173, open: true },
});

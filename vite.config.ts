import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // In production (build), use the GitHub Pages repo subpath.
  // In dev (serve), use '/' so localhost:5173 works as before.
  base: command === 'build' ? '/unity-2/' : '/',
  assetsInclude: ['**/*.fbx'],
  server: { port: 5173, open: true },
}));

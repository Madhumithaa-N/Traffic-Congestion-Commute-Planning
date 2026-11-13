import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // `import.meta.dirname` is preferred; fall back to __dirname for older Node
  const root = typeof import.meta.dirname !== 'undefined'
    ? import.meta.dirname
    : path.dirname(new URL(import.meta.url).pathname);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': root,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // SPA fallback: serve index.html for all unknown routes (required for React Router / client-side routing on Render Static Sites)
    appType: 'spa' as const,
  };
});

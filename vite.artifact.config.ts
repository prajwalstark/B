import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-file build for hosting: React is loaded from a CDN (UMD globals) and the app ships as one IIFE.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: 'src/main.tsx', formats: ['iife'], name: 'Pitwall', fileName: () => 'app.js' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', 'react/jsx-runtime': 'ReactJSXRuntime' },
        assetFileNames: 'app.[ext]',
      },
    },
  },
});

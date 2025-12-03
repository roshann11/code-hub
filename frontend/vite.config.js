import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  define: {
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      process: "process/browser",
    }
  }
})
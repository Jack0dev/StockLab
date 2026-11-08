import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Permissions-Policy': 'unload=*',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@presentation': path.resolve(__dirname, './src/presentation'),
      '@service': path.resolve(__dirname, './src/service'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
    },
  },
})

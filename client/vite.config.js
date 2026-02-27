import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:6767',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:6767',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  build: {
    minify: false
  }
})

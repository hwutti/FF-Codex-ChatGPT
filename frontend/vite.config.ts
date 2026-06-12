import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    // Rollup statt esbuild für Minification — umgeht esbuild 0.25.x Regex-Bug
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          utils:    ['axios', 'date-fns'],
          pdf:      ['jspdf', 'jspdf-autotable'],
          icons:    ['lucide-react'],
          sanitize: ['dompurify'],
          // Leaflet in eigenen Chunk — verhindert Einbau in vendor-Chunk
          // und erzwingt neuen Hash beim nächsten Build
          leaflet:  ['leaflet'],
        },
      },
    },
  },
})

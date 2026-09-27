import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Served once over the museum LAN, so one ~240 kB gzipped bundle is fine.
    chunkSizeWarningLimit: 900,
  },
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Garantit une copie unique de React dans le bundle : une divergence
    // react/react-dom (ex. copie 19.2.8 nichée vs root 19.2.3) provoque
    // « Cannot read properties of null (reading 'useRef') ».
    dedupe: ['react', 'react-dom'],
  },
})

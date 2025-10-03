import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages necesita el subpath del repo.
export default defineConfig({
  plugins: [react()],
  base: '/arbitraje-usdt-ars/', // ⚠️ cambialo si el repo tiene otro nombre
})

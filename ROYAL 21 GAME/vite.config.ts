import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // PORT lets a tool that already picked a free port hand it over; 5173 stays
  // the default for `npm run dev` on its own.
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    allowedHosts: ['.loca.lt', '.trycloudflare.com', '.ngrok.io', '.ngrok-free.app'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.loca.lt', '.trycloudflare.com', '.ngrok.io', '.ngrok-free.app'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});

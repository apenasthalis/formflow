import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const port = Number(process.env.VITE_PORT ?? 5173);
// URL pública do app (Nginx local). Necessária para o HMR funcionar atrás do proxy.
const publicUrl = process.env.APP_HTTP_URL ?? 'http://localhost';

/** Porta pública do app, usada pelo cliente do HMR através do Nginx. */
function resolvePublicPort(url: string): number {
  const { port, protocol } = new URL(url);
  if (port) return Number(port);
  return protocol === 'https:' ? 443 : 80;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    // O HMR usa WebSocket; o mesmo host público do Nginx é informado ao cliente.
    hmr: {
      clientPort: resolvePublicPort(publicUrl),
    },
    watch: {
      // Ignora o sistema de arquivos do host para os módulos do container.
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Separa as bibliotecas grandes para melhorar o cache entre deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-label',
            '@radix-ui/react-alert-dialog',
          ],
        },
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    // رفع حد التنبيه إلى 1600 كيلوبايت لمنع ظهور الرسالة الصفراء
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // فصل مكتبات النظام عن كود التطبيق لتسريع التحميل
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});

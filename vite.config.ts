import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      base: '/arcade-hub/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('/node_modules/three/')) return 'three-engine';
              if (id.includes('/node_modules/phaser/')) return 'phaser-engine';
              if (id.includes('/node_modules/@supabase/')) return 'supabase-client';
              if (id.includes('/node_modules/react')) return 'react-vendor';
              return undefined;
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

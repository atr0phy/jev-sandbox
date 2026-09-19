import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';
import { createApi } from './src/soup/server/api.js';

export const createViteConfig = (api = createApi()): UserConfig => {
  return {
    root: 'src/soup/client',
    plugins: [
      react(),
      {
        name: 'soup-api',
        configureServer(server) {
          server.middlewares.use(api);
        },
        configurePreviewServer(server) {
          server.middlewares.use(api);
        },
      },
    ],
    // 環境変数はサーバーでprocess.envから取得する。.envファイルは読み込まない。
    envDir: false,
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: { outDir: '../../../dist', emptyOutDir: true },
  };
};

export default defineConfig(() => createViteConfig());

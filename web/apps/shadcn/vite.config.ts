import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sunucu bu şablonu /shadcn/ altında yayınlar; derleme çıktısı doğrudan
// FyBlue.Server/wwwroot/shadcn klasörüne yazılır.
export default defineConfig({
    base: '/shadcn/',
    resolve: {
        alias: {
            src: resolve(__dirname, 'src'),
            '@': resolve(__dirname, 'src'),
        },
    },
    plugins: [react()],
    server: {
        port: 5174,
        proxy: { '/api': 'http://localhost:5151', '/hangfire': 'http://localhost:5151' },
    },
    build: {
        outDir: '../../../src/FyBlue.Server/wwwroot/shadcn',
        emptyOutDir: true,
    },
});

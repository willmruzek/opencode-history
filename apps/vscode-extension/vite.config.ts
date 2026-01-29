import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    outDir: 'dist',
    sourcemap: true,
    target: 'node16',
    rollupOptions: {
      external: ['vscode'],
      output: {
        exports: 'auto',
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'mining-inline-boot-diagnostics',
    transformIndexHtml(html) {
      const boot=readFileSync(new URL('./src/boot/telemetry.js',import.meta.url),'utf8');
      const loadingCss=readFileSync(new URL('./src/game/ui/loading.css',import.meta.url),'utf8');
      const emblem=readFileSync(new URL('./src/game/ui/loading-emblem.svg',import.meta.url),'utf8');
      return html.replace('<html lang="zh-CN">',`<html lang="zh-CN" data-mining-build="${new Date().toISOString()}">`)
        .replace('<!-- mining-boot-instrumentation -->',`<script>${boot}</script>`)
        .replace('<!-- mining-loading-styles -->',`<style>${loadingCss}</style>`)
        .replace('<!-- mining-loading-emblem -->',emblem.replace('<svg ', '<svg class="loading-emblem" '));
    },
  }],
  build: { outDir: 'dist' },
});

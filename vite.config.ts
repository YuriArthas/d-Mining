import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error Node build utility is deliberately shared with the delivery.
import { prepareLocales } from './tools/prepare-locales.mjs';
// @ts-expect-error Cross-platform path audit runs before resolving modules.
import { checkModulePaths } from './tools/check-module-paths.mjs';

checkModulePaths(new URL('./src/', import.meta.url));
prepareLocales();
const metadata = new URL('./DELIVERY.json', import.meta.url);
const buildTime = existsSync(metadata) ? JSON.parse(readFileSync(metadata, 'utf8')).buildTime : new Date().toISOString();
// iPhone 14 Pro shipped with iOS/Safari 16.0. Vite's default starts at 16.4.
// Vite also inherits these build options for the terrain worker.
const browserTarget = ['chrome111', 'edge111', 'firefox114', 'safari16.0', 'ios16.0'];
export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'mining-local-resources',
    configureServer(server) {
      server.watcher.on('all', (_event, path) => {
        if (path.replaceAll('\\', '/').includes('/i18n/locales/')) {
          prepareLocales();
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
    transformIndexHtml(html) {
      const bootPacks = prepareLocales().map((p: { id: string; locale: string; messages: Record<string, string> }) => ({
        id: p.id, locale: p.locale, messages: Object.fromEntries(Object.entries(p.messages).filter(([id]) => id.startsWith('boot.'))),
      }));
      const config = JSON.stringify(bootPacks).replace(/</g, '\\u003c');
      const boot = readFileSync(new URL('./src/boot/loading.js', import.meta.url), 'utf8');
      const css = readFileSync(new URL('./src/game/ui/loading.css', import.meta.url), 'utf8');
      const emblem = readFileSync(new URL('./src/game/ui/loading-emblem.svg', import.meta.url), 'utf8');
      return html.replace('<html lang="zh-CN">', `<html lang="zh-CN" data-mining-build="${buildTime}">`)
        .replace('<!-- mining-boot-instrumentation -->', `<script>window.__MINING_BOOT_LOCALES__=${config};${boot}</script>`)
        .replace('<!-- mining-loading-styles -->', `<style>${css}</style>`)
        .replace('<!-- mining-loading-emblem -->', emblem.replace('<svg ', '<svg class="loading-emblem" '));
    },
  }],
  build: { outDir: 'dist', target: browserTarget, cssTarget: browserTarget },
});

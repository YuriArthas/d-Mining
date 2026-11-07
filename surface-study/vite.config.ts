import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const assetRevisions=Object.fromEntries(['architecture','nature'].map(name=>[name,createHash('sha256').update(readFileSync(new URL(`./public/assets/blockcraft/${name}.glb`,import.meta.url))).digest('hex').slice(0,16)]));
export default defineConfig({ base: './', define:{__ASSET_REVISIONS__:JSON.stringify(assetRevisions)}, build: { outDir: 'dist', chunkSizeWarningLimit: 1000 } });

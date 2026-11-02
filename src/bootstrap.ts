// Keep loading failure UI independent of the game dependency graph.
import('./main.tsx').catch(error => window.__MINING_BOOT__?.fail(error));

import type { SavedGame } from "./SaveBootstrap.ts";
import { LocalStorageSaveStore } from "./LocalStorageSaveStore.ts";
export function attachSaveDebug(game: SavedGame) {
  const debug = {
    namespace: game.namespace,
    transient: game.transient,
    status: game.saves.getStatus,
    flush: () => game.saves.flush(),
    progress: () => game.session.exportProgress(),
    metrics: () => ({ ...game.saves.metrics, world: game.world.stats() }),
    // Explicit acceptance tests use separate localStorage keys, never the player's slot.
    openTestStore: (id: string) => {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
        throw Error("Invalid test store id");
      return LocalStorageSaveStore.open(`mining:acceptance:store-${id}`);
    },
  };
  window.__miningSave = debug;
  return debug;
}
declare global {
  interface Window {
    __miningSave?: ReturnType<typeof attachSaveDebug>;
  }
}

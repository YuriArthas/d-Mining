import type { SavedGame } from "./SaveBootstrap.ts";
import { IndexedDbSaveStore } from "./IndexedDbSaveStore.ts";
export function attachSaveDebug(game: SavedGame) {
  const debug = {
    namespace: game.namespace,
    status: game.saves.getStatus,
    flush: () => game.saves.flush(),
    progress: () => game.session.exportProgress(),
    metrics: () => ({ ...game.saves.metrics, world: game.world.stats() }),
    // Public browser integration tests use separate databases, never the player's slot.
    openTestStore: (id: string) => {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
        throw Error("Invalid test store id");
      return IndexedDbSaveStore.open(`mining:acceptance:store-${id}`);
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

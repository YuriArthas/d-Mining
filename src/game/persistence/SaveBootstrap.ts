import { GameSession } from "../application/GameSession.ts";
import type { SessionContent } from "../application/SessionContent.ts";
import { SparseWorld, type WorldGeneration } from "../terrain/SparseWorld.ts";
import { LocalStorageSaveStore } from "./LocalStorageSaveStore.ts";
import { MemorySaveStore } from './MemorySaveStore.ts';
import type { SaveStore } from './SaveStore.ts';
import { debugOptions } from '../runtime/debugOptions.ts';
import { acquireSaveOwnership } from "./SaveOwnership.ts";
import { SaveCoordinator } from "./SaveCoordinator.ts";
import { compatibleHead } from "./saveMigrations.ts";
import type { SaveHeadV1 } from "./saveTypes.ts";
import { tr } from '../i18n/i18n.ts';
export type SavedGame = Awaited<ReturnType<typeof openSavedGame>>;
export async function openSavedGame(
  namespace: string,
  content: SessionContent,
  generation: WorldGeneration,
  signal: AbortSignal,
  onProgress: (text: string) => void = () => {},
  transient = false,
) {
  const release = transient ? () => {} : await acquireSaveOwnership(namespace, signal);
  let store: SaveStore | undefined, saves: SaveCoordinator | undefined;
  let closing: Promise<void> | undefined;
  let unsubscribe = () => {};
  try {
    signal.throwIfAborted();
    store = transient ? new MemorySaveStore() : await LocalStorageSaveStore.open(namespace);
    signal.throwIfAborted();
    onProgress(tr("msg.reading_your_save"));
    const read = await store.read();
    signal.throwIfAborted();
    const head: SaveHeadV1 =
      read.kind === "found"
        ? compatibleHead(read.head, generation)
        : {
            formatVersion: 1,
            revision: 1,
            savedAt: Date.now(),
            regionCount: 0,
            world: {
              generationVersion: generation.version,
              seed: generation.seed,
              regionEncoding: 1,
            },
          };
    const session =
      read.kind === "found"
        ? GameSession.fromData(read.progress, content)
        : GameSession.createNew(content);
    const world = new SparseWorld({ ...generation, seed: head.world.seed });
    if (read.kind === "found") {
      let slice = performance.now();
      for (let i = 0; i < read.regions.length; i++) {
        world.restoreRegion(read.regions[i]);
        if (performance.now() - slice > 8) {
          onProgress(tr("msg.restoring_the_pit_i_regions", { i: i + 1, regions: read.regions.length }));
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          signal.throwIfAborted();
          slice = performance.now();
        }
      }
    } else {
      await store.commit({
        expectedRevision: null,
        head,
        progress: session.exportProgress(),
        regions: [],
      });
    }
    signal.throwIfAborted();
    const coordinator = (saves = new SaveCoordinator(
      store,
      head,
      session.exportProgress.bind(session),
      world,
    ));
    unsubscribe = session.onProgressCommitted(({ urgent }) =>
      coordinator.requestSave(urgent),
    );
    const disconnectStatus = coordinator.subscribe(() => {
      if (coordinator.getStatus().state === "conflicted")
        session.setSuspended(true);
    });
    return {
      namespace,
      transient,
      session,
      world,
      saves: coordinator,
      close: () =>
        (closing ??= (async () => {
          session.setSuspended(true);
          unsubscribe();
          disconnectStatus();
          await coordinator.stop();
          store!.close();
          release();
        })()),
    };
  } catch (error) {
    unsubscribe();
    await saves?.stop();
    store?.close();
    release();
    throw error;
  }
}
/** Saves of the economy v2 (economy.json, three currencies) live apart from every older save; earlier ones
 *  (`journey-v1`) are simply not read any more. */
export function saveNamespace(
  location: Pick<Location, "pathname" | "search">,
): { name: string; transient: boolean } {
  const params = new URLSearchParams(location.search),
    debug = debugOptions(location.search).enabled;
  const testId = debug ? params.get("saveTest") : null;
  if (testId && !/^[a-zA-Z0-9_-]{1,80}$/.test(testId))
    throw Error("存档验收标识错误");
  const mode = /\/games\/mining\//.test(location.pathname)
    ? "production"
    : "test";
  return {
    name: testId
      ? `mining:acceptance:${testId}`
      : debug ? `mining:debug:${mode}:economy-v2`
      : `mining:${mode}:economy-v2`,
    transient: debug && !testId,
  };
}

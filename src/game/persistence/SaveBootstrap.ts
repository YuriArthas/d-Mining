import { GameSession } from "../application/GameSession.ts";
import type { SessionContent } from "../application/SessionContent.ts";
import { SparseWorld, type WorldGeneration } from "../terrain/SparseWorld.ts";
import { IndexedDbSaveStore } from "./IndexedDbSaveStore.ts";
import { acquireSaveOwnership } from "./SaveOwnership.ts";
import { SaveCoordinator } from "./SaveCoordinator.ts";
import { compatibleHead } from "./saveMigrations.ts";
import type { SaveHeadV1 } from "./saveTypes.ts";
export type SavedGame = Awaited<ReturnType<typeof openSavedGame>>;
export async function openSavedGame(
  namespace: string,
  content: SessionContent,
  generation: WorldGeneration,
  signal: AbortSignal,
  onProgress: (text: string) => void = () => {},
) {
  const release = await acquireSaveOwnership(namespace, signal);
  let store: IndexedDbSaveStore | undefined, saves: SaveCoordinator | undefined;
  let closing: Promise<void> | undefined;
  let connectionError: Error | null = null;
  let unsubscribe = () => {};
  try {
    signal.throwIfAborted();
    store = await IndexedDbSaveStore.open(namespace, (error) => {
      connectionError = error;
      saves?.invalidate(error);
    });
    signal.throwIfAborted();
    onProgress("正在读取存档");
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
          onProgress(`正在恢复矿坑 ${i + 1}/${read.regions.length}`);
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
    if (connectionError) throw connectionError;
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
export function saveNamespace(
  location: Pick<Location, "pathname" | "search">,
): { name: string; samples: boolean } {
  const params = new URLSearchParams(location.search),
    debug = params.get("debug") === "1";
  const samples = debug && params.get("samples") === "1";
  const testId = debug ? params.get("saveTest") : null;
  if (testId && !/^[a-zA-Z0-9_-]{1,80}$/.test(testId))
    throw Error("存档验收标识错误");
  const mode = /\/games\/mining\//.test(location.pathname)
    ? "production"
    : "test";
  return {
    name: testId
      ? `mining:acceptance:${testId}${samples ? ":samples" : ""}`
      : `mining:${mode}${samples ? ":samples" : ""}`,
    samples,
  };
}

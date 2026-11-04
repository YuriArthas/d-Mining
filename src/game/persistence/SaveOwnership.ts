export async function acquireSaveOwnership(
  name: string,
  signal: AbortSignal,
  manager: LockManager | undefined = globalThis.navigator?.locks,
  protocol = globalThis.location?.protocol,
): Promise<() => void> {
  signal.throwIfAborted();
  // Only HTTPS sessions use cross-page ownership; HTTP must remain playable.
  if (protocol !== "https:" || !manager) return () => {};
  return new Promise((resolve, reject) => {
    const job = manager.request(name, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        reject(Error("游戏已在其他标签页打开，请关闭原页面后重试"));
        return;
      }
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      let release!: () => void;
      const held = new Promise<void>((done) => {
        release = done;
      });
      resolve(release);
      await held;
    });
    void job.catch(reject);
  });
}

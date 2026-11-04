export async function acquireSaveOwnership(
  name: string,
  signal: AbortSignal,
  manager: LockManager = navigator.locks,
): Promise<() => void> {
  if (!manager) throw Error("当前浏览器不支持安全的多页面存档，请更新浏览器");
  signal.throwIfAborted();
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

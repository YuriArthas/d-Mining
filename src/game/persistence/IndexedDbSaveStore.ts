import { record } from "../logic/data.ts";
import {
  readHead,
  SaveConflict,
  type SaveBatchV1,
  type SaveRead,
} from "./saveTypes.ts";
import type { SaveStore } from "./SaveStore.ts";
const STORES = ["head", "progress", "regions"];
export class IndexedDbSaveStore implements SaveStore {
  private readonly db: IDBDatabase;
  durability = "unknown";
  constructor(db: IDBDatabase) {
    this.db = db;
  }
  static open(
    name: string,
    invalidated: (error: Error) => void = () => {},
    factory: IDBFactory = indexedDB,
  ): Promise<IndexedDbSaveStore> {
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const req = factory.open(name, 1);
      req.onupgradeneeded = () => {
        for (const name of STORES) req.result.createObjectStore(name);
      };
      req.onblocked = () => {
        abandoned = true;
        reject(Error("存档升级被其他页面阻挡，请关闭旧游戏页面后重试"));
      };
      req.onerror = () => reject(req.error ?? Error("无法打开本地存档"));
      req.onsuccess = () => {
        const db = req.result;
        if (abandoned) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          invalidated(Error("存档版本已改变，请刷新游戏"));
        };
        db.onclose = () =>
          invalidated(Error("本地存档连接已关闭，请重新进入游戏"));
        resolve(new IndexedDbSaveStore(db));
      };
    });
  }
  read(): Promise<SaveRead> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES, "readonly");
      const head = tx.objectStore("head").get("main"),
        progress = tx.objectStore("progress").get("main");
      const regions = tx.objectStore("regions").getAll(),
        keys = tx.objectStore("regions").getAllKeys();
      const heads = tx.objectStore("head").count(),
        progresses = tx.objectStore("progress").count();
      tx.onabort = () => reject(tx.error ?? Error("读取存档被中断"));
      tx.onerror = () => {}; // abort owns completion; never cancel the default abort.
      tx.oncomplete = () => {
        try {
          if (
            head.result === undefined &&
            heads.result === 0 &&
            progresses.result === 0 &&
            !regions.result.length
          ) {
            resolve({ kind: "missing" });
            return;
          }
          const h = readHead(head.result),
            p = record(progress.result);
          if (
            heads.result !== 1 ||
            progresses.result !== 1 ||
            p.revision !== h.revision ||
            regions.result.length !== h.regionCount
          )
            throw Error("存档记录不完整");
          const values = regions.result.map((value, i) => {
            const r = record(value),
              data = record(r.data);
            if (
              !Number.isSafeInteger(r.writtenRevision) ||
              (r.writtenRevision as number) < 1 ||
              (r.writtenRevision as number) > h.revision ||
              !Array.isArray(data.region) ||
              JSON.stringify(keys.result[i]) !== JSON.stringify(data.region)
            )
              throw Error("矿坑记录版本或坐标错误");
            return data;
          });
          resolve({
            kind: "found",
            head: h,
            progress: p.data,
            regions: values,
          });
        } catch (error) {
          reject(error);
        }
      };
    });
  }
  commit(batch: SaveBatchV1): Promise<void> {
    return new Promise((resolve, reject) => {
      const h = readHead(batch.head);
      if (h.revision !== (batch.expectedRevision ?? 0) + 1) {
        reject(Error("存档提交序号错误"));
        return;
      }
      const tx = this.db.transaction(STORES, "readwrite", {
        durability: "strict",
      });
      this.durability = tx.durability ?? "unknown";
      let failure: unknown;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? Error("保存被中断"));
      tx.onerror = () => {};
      const req = tx.objectStore("head").get("main");
      req.onsuccess = () => {
        try {
          const current =
            req.result === undefined ? null : readHead(req.result).revision;
          if (current !== batch.expectedRevision) throw new SaveConflict();
          tx.objectStore("progress").put(
            { revision: h.revision, data: batch.progress },
            "main",
          );
          for (const region of batch.regions)
            tx.objectStore("regions").put(
              { writtenRevision: h.revision, data: region },
              region.region,
            );
          tx.objectStore("head").put(h, "main");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
    });
  }
  close() {
    this.db.close();
  }
}

import type { SaveBatchV1, SaveRead } from "./saveTypes.ts";
// Rejections preserve the previous committed save. No gameplay dependencies.
export interface SaveStore {
  read(): Promise<SaveRead>;
  commit(batch: SaveBatchV1): Promise<void>;
  close(): void;
}

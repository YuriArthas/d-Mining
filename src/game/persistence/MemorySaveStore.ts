import type { SaveStore } from './SaveStore.ts';
import { readHead, SaveConflict, type SaveBatchV1, type SaveRead } from './saveTypes.ts';

/** Explicit debug sessions only. Never reads or writes the player's persistent storage. */
export class MemorySaveStore implements SaveStore {
  private saved: { head: SaveBatchV1['head']; progress: SaveBatchV1['progress']; regions: SaveBatchV1['regions'][number][] } | null = null;
  private closed = false;
  async read(): Promise<SaveRead> {
    if (this.closed) throw Error('Debug save is closed');
    return this.saved ? { kind: 'found', ...structuredClone(this.saved) } : { kind: 'missing' };
  }
  async commit(batch: SaveBatchV1) {
    if (this.closed) throw Error('Debug save is closed');
    const head = readHead(batch.head);
    if ((this.saved?.head.revision ?? null) !== batch.expectedRevision) throw new SaveConflict();
    if (head.revision !== (batch.expectedRevision ?? 0) + 1) throw Error('Invalid debug save revision');
    const regions = new Map(this.saved?.regions.map(region => [region.region.join(','), region]));
    for (const region of batch.regions) regions.set(region.region.join(','), region);
    if (regions.size !== head.regionCount) throw Error('Incomplete debug save regions');
    this.saved = structuredClone({ head, progress: batch.progress, regions: [...regions.values()] });
  }
  close() { this.closed = true; this.saved = null; }
}

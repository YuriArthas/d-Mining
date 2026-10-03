import { buildRegion, type BuildJob, type BuildReply } from '../terrain/meshing.ts';
const worker = self as unknown as { onmessage: ((event: MessageEvent<BuildJob>) => void) | null; postMessage: (data: BuildReply, transfer?: Transferable[]) => void };
worker.onmessage = ({ data: job }) => {
  try {
    const results = job.regions.map(region => ({ version: region.version, data: buildRegion(job.kind, region.coord, job.size, region.edits, job.generation) }));
    const transfer = results.flatMap(({ data: { mesh: m } }) => [m.positions.buffer, m.normals.buffer, m.uvs.buffer, m.tiles.buffer, m.indices.buffer]) as ArrayBuffer[];
    worker.postMessage({ id: job.id, epoch: job.epoch, transaction: job.transaction, results }, transfer);
  } catch (error) { worker.postMessage({ id: job.id, epoch: job.epoch, transaction: job.transaction, error: String(error) }); }
};

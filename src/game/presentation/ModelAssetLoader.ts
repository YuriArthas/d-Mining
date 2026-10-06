import {
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  CompressedTexture,
  RGBAFormat,
  RGBFormat,
  Vector3,
  type WebGLRenderer,
} from "three";
import { AssetPrefetch } from "../assets/AssetPrefetch.ts";
import { downloadModel } from "../assets/downloadModel.ts";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { disposeScenery } from "./disposeScenery.ts";
import { pruneInactiveMaps } from "./MaterialPreparation.ts";
import { stabilizeShadows } from "./stableShadow.ts";
import {
  uploadSurfaceTextures,
  TEXTURE_UPLOAD_LIMITS,
} from "./uploadSurfaceTexture.ts";
export type ModelManifest = {
  parts: string[];
  bytes: number;
  decodedBytes: number;
  taskId?: string;
  generationId?: string;
  materialProfile?: string;
  source: string;
};
export type ModelRequest = {
  name: string;
  manifest: ModelManifest;
  parts: string[];
  bytes: number;
  decodedBytes: number;
  instances: number;
};
export async function loadModelAssets(
  renderer: WebGLRenderer,
  requests: readonly ModelRequest[],
  signal: AbortSignal,
  prepareMaterial: (
    material: MeshStandardMaterial,
    request: ModelRequest,
  ) => void,
  onProgress?: (done: number, total: number) => void,
  afterUpload?: (root: Group, request: ModelRequest) => void,
  externalTextures: ReadonlySet<Texture> = new Set(),
) {
  const templates = new Map<string, Group>(),
    stats: Record<string, unknown>[] = [];
  const ktx = new KTX2Loader().setWorkerLimit(2).detectSupport(renderer);
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .setKTX2Loader(ktx);
  const textures = new Set<Texture>();
  const textureUploads = {
    textures: 0,
    batches: 0,
    waitMs: 0,
    maxBatchBytes: 0,
    ...TEXTURE_UPLOAD_LIMITS,
  };
  const cleanup = () => {
    const abandoned = new Group();
    abandoned.add(...templates.values());
    disposeScenery(abandoned, undefined, externalTextures);
    templates.clear();
  };
  let prefetch:
    | AssetPrefetch<ModelRequest, Awaited<ReturnType<typeof downloadModel>>>
    | undefined;
  try {
    prefetch = new AssetPrefetch(
      requests,
      (item) => item.decodedBytes,
      downloadModel,
      signal,
    );
    // Downloads overlap parsing/uploading; one model consumer, two KTX workers.
    for (;;) {
      const lease = await prefetch.take();
      if (!lease) break;
      try {
        const { name, manifest } = lease.item,
          { buffer, bytes, downloadMs } = lease.value;
        signal.throwIfAborted();
        const decodeStart = performance.now(),
          gltf = await loader.parseAsync(buffer, ""),
          root = new Group();
        templates.set(name, root);
        gltf.scene.rotation.y = -Math.PI / 2;
        root.add(gltf.scene);
        root.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(root),
          size = bounds.getSize(new Vector3()),
          center = bounds.getCenter(new Vector3());
        gltf.scene.position.set(-center.x, -bounds.min.y, -center.z);
        root.userData.width = size.x;
        root.userData.height = size.y;
        root.userData.depth = size.z;
        let triangles = 0;
        const pendingTextures = new Set<Texture>();
        root.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          o.castShadow = false;
          o.receiveShadow = false;
          for (const m of (Array.isArray(o.material)
            ? o.material
            : [o.material]) as MeshStandardMaterial[]) {
            prepareMaterial(m, lease.item);
            pruneInactiveMaps(m);
            stabilizeShadows(m);
            for (const v of Object.values(m))
              if (v instanceof Texture) {
                if (
                  !(v instanceof CompressedTexture) ||
                  Number(v.format) === RGBAFormat ||
                  Number(v.format) === RGBFormat
                )
                  throw new Error(
                    "当前显卡未使用 GPU 压缩纹理，停止加载以避免内存耗尽",
                  );
                v.anisotropy = 8;
                if (!textures.has(v)) pendingTextures.add(v);
                textures.add(v);
              }
          }
          triangles +=
            (o.geometry.index?.count ?? o.geometry.attributes.position.count) /
            3;
        });
        const upload = await uploadSurfaceTextures(
          renderer,
          pendingTextures,
          signal,
        );
        textureUploads.textures += upload.textures;
        textureUploads.batches += upload.batches;
        textureUploads.waitMs += upload.waitMs;
        textureUploads.maxBatchBytes = Math.max(
          textureUploads.maxBatchBytes,
          upload.maxBatchBytes,
        );
        afterUpload?.(root, lease.item);
        signal.throwIfAborted();
        onProgress?.(templates.size, requests.length);
        stats.push({
          name,
          taskId: manifest.taskId,
          generationId: manifest.generationId,
          source: manifest.source,
          bytes,
          triangles,
          downloadMs,
          decodeMs: performance.now() - decodeStart,
          normalizedFront: "+Z",
          originalSize: size.toArray(),
          instances: lease.item.instances,
        });
      } finally {
        lease.release();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    await prefetch?.close();
    ktx.dispose();
  }
  if (signal.aborted) {
    cleanup();
    signal.throwIfAborted();
  }
  return {
    templates,
    stats,
    textures,
    textureUploads,
    prefetch: { ...prefetch!.stats, limits: prefetch!.limits },
  };
}

import type { SparseWorld } from '../terrain/SparseWorld.ts';
import { CameraGrade } from '../presentation/CameraGrade.ts';
import type { CampContent } from "../content/campContent.ts";
import type {
  Group,
  HemisphereLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { GameInput } from "../GameInput.ts";
import type { GameSession } from "../application/GameSession.ts";
import type { LoadingEvent } from "../ui/loadingState.ts";
import type { SurfaceTime } from "../world/SceneLighting.ts";
import { WORLD_GENERATION } from "../terrain/SparseWorld.ts";
import { stratumAtDepth } from "../terrain/strata.ts";
import { themeById } from "../content/themes.ts";
import { CharacterPhysics, initPhysics } from "../validation/physics.ts";
import { TerrainStream } from "../validation/TerrainStream.ts";
import { prepareSpawnTerrain } from "../validation/prepareSpawnTerrain.ts";
import { loadStaticSurface } from "../presentation/StaticSurface.ts";
import { SurfaceEnvironment } from "../presentation/SurfaceEnvironment.ts";
import { SceneLightingRig } from "../presentation/SceneLightingRig.ts";
import { EnvironmentController } from "../presentation/EnvironmentController.ts";
import { SceneryView } from "../presentation/SceneryView.ts";
import { SceneryCollision } from "../presentation/SceneryCollision.ts";
import { PetFollowers } from "../presentation/PetFollowers.ts";
import { EggStandLabels } from "../presentation/EggStandLabels.ts";
import { disposeScenery } from "../presentation/disposeScenery.ts";
import { SurfaceHubView } from "../presentation/SurfaceHubView.ts";
import { prepareShaders } from "../presentation/prepareShaders.ts";
import { createScenerySites } from "../world/createScenerySites.ts";
import { PlayerController } from "./PlayerController.ts";
import { CameraView } from "./CameraView.ts";
import { MiningInteraction } from "./MiningInteraction.ts";
import { DisposalScope } from "./DisposalScope.ts";

export type StartupStats = ReturnType<typeof createStartupStats>;
export function createStartupStats() {
  return {
    started: performance.now(),
    physicsMs: 0,
    assetsReadyMs: 0,
    terrainReadyMs: 0,
    sceneAttachMs: 0,
    terrainPendingAtAttach: -1,
    firstPlayableMs: 0,
    roomPrepareMs: 0,
    warmupMs: 0,
    warmupPrograms: 0,
    warmupObjects: 0,
    parallelShaderCompile: false,
  };
}
export type PreparedGame = Awaited<ReturnType<typeof startGame>>;
export type StartGameOptions = {
  content: CampContent;
  renderer: WebGLRenderer;
  scene: Scene;
  root: Group;
  ambient: HemisphereLight;
  sun: DirectionalLight;
  camera: PerspectiveCamera;
  avatar: Group;
  input: GameInput;
  session: GameSession;
  restoredWorld?: SparseWorld;
  samples: boolean;
  previewLayer: string | null;
  signal: AbortSignal;
  settings: () => { time: SurfaceTime; bakedShadows: boolean };
  onStatus: (text: string) => void;
  onLoading: (event: LoadingEvent) => void;
};

// Composition boundary. Children receive explicit dependencies, never this whole options object.
export async function startGame(options: StartGameOptions) {
  const {
    content,
    renderer,
    scene,
    root,
    ambient,
    sun,
    camera,
    avatar,
    input,
    session,
    signal,
  } = options;
  const scope = new DisposalScope(),
    abort = new AbortController();
  const cancel = () => {
    abort.abort(signal.reason);
    scope.dispose();
  };
  signal.addEventListener("abort", cancel, { once: true });
  scope.defer(() => signal.removeEventListener("abort", cancel));
  const check = () => {
    signal.throwIfAborted();
    abort.signal.throwIfAborted();
  };
  const onStatus = (text: string) => {
    if (!abort.signal.aborted) options.onStatus(text);
  };
  const onLoading = (event: LoadingEvent) => {
    if (!abort.signal.aborted) options.onLoading(event);
  };
  const startup = createStartupStats();
  try {
    check();
    renderer.shadowMap.autoUpdate = false;
    const cameraGrade = new CameraGrade();
    scope.defer(() => cameraGrade.dispose());
    const sky = new SurfaceEnvironment(
      renderer,
      scene,
      content.environment.sky,
    );
    let lights: SceneLightingRig;
    try {
      lights = new SceneLightingRig();
    } catch (error) {
      sky.dispose();
      throw error;
    }
    const environment = new EnvironmentController(
      scene,
      ambient,
      sun,
      sky,
      lights,
      content.environment,
    );
    scope.defer(() => environment.dispose());
    root.add(lights.group);
    onStatus("正在载入矿场场景");
    let assetCount = 0,
      assetTotal = 0,
      terrainDone = false;
    const worldTask = initPhysics().then(async () => {
      check();
      startup.physicsMs = performance.now() - startup.started;
      const generation = options.restoredWorld?.generation ?? {
        ...WORLD_GENERATION,
        samples: options.samples,
        layers: content.layers,
      };
      const physics = new CharacterPhysics(generation.samples);
      scope.defer(() => physics.dispose());
      const terrain = new TerrainStream(
        physics,
        undefined,
        session.collected,
        generation,
        options.restoredWorld,
      );
      scope.defer(() => {
        terrain.group.removeFromParent();
        terrain.dispose();
      });
      if (options.previewLayer) {
        const room = content.rooms.find((r) => r.id === options.previewLayer);
        if (!room) throw new Error("未知预览楼层");
        physics.teleport(room.spawn);
      }
      await prepareSpawnTerrain(
        terrain,
        physics.feet(),
        abort.signal,
        (done, total) => {
          onStatus(`正在准备出生点地形 ${done}/${total}`);
          onLoading({ stage: "terrain", done, total });
        },
      );
      check();
      onLoading({ stage: "terrain", done: 1, total: 1, complete: true });
      terrainDone = true;
      startup.terrainReadyMs = performance.now() - startup.started;
      onStatus(
        `正在载入矿场场景 ${assetCount}${assetTotal ? "/" + assetTotal : ""}`,
      );
      return { physics, terrain };
    });
    const surfaceTask = loadStaticSurface(
      renderer,
      content.surface,
      abort.signal,
      (done, total) => {
        onLoading({ stage: "assets", done, total });
        assetCount = done;
        assetTotal = total;
        if (terrainDone) onStatus(`正在载入矿场场景 ${done}/${total}`);
      },
    ).then((surface) => {
      scope.defer(surface.dispose);
      check();
      onLoading({
        stage: "assets",
        done: assetCount,
        total: assetTotal,
        complete: true,
      });
      startup.assetsReadyMs = performance.now() - startup.started;
      return surface;
    });
    const [{ physics, terrain }, surface] = await Promise.all([
      worldTask,
      surfaceTask,
    ]);
    check();
    onStatus("正在准备画面");
    const cameraView = new CameraView(),
      player = new PlayerController(physics, terrain, input, session);
    scope.defer(
      session.attach({
        cell: (cell) => terrain.cell(cell),
        canMine: (cell) => terrain.canMine(cell),
        pending: (cell) => terrain.pending(cell),
        mine: (targets) => terrain.mineMany(targets),
        cancelMining: () => terrain.cancelPending(),
        travelTo: player.travelTo,
        returnToSurface: () => player.travelTo(content.returnPoint),
      }),
    );
    const interaction = new MiningInteraction(session);
    scope.defer(() => interaction.dispose());
    root.add(interaction.group);
    surface.retain();
    const eggLabels = new EggStandLabels(content.hub.eggs, session.pets.getSnapshot().eggs);
    root.add(eggLabels.group);
    scope.defer(() => disposeScenery(eggLabels.group));
    const petFollowers = new PetFollowers();
    root.add(petFollowers.group);
    scope.defer(() => petFollowers.dispose());
    const updatePets = () => petFollowers.sync(session.pets.getSnapshot().pets.flatMap(card =>
      card.equippedSlot === null ? [] : [{ ...card.pet, slot: card.equippedSlot }]));
    updatePets();
    scope.defer(session.pets.subscribe(updatePets));
    const hub = new SurfaceHubView(surface.group, content.hub),
      updateHub = () => {
        hub.update(session.getSnapshot().destinations);
      };
    updateHub();
    scope.defer(session.subscribe(updateHub));
    const sites = createScenerySites(content.rooms, content.surface.plan),
      sceneryCollision = new SceneryCollision(physics, sites);
    scope.defer(() => sceneryCollision.dispose());
    const facilities = new SceneryView(surface, sites);
    scope.defer(() => facilities.dispose());
    root.add(facilities.group, terrain.group);
    startup.sceneAttachMs = performance.now() - startup.started;
    startup.terrainPendingAtAttach = terrain.snapshot().queue;
    const roomStart = performance.now();
    await facilities.prepare(abort.signal, (done, total) => {
      onStatus(`正在准备场景 ${done}/${total}`);
      onLoading({ stage: "rooms", done, total });
    });
    check();
    onLoading({ stage: "rooms", done: 1, total: 1, complete: true });
    startup.roomPrepareMs = performance.now() - roomStart;
    sceneryCollision.sync(physics.feet());
    const feet = physics.feet(),
      layer = stratumAtDepth(Math.max(0, -feet[1] + 0.04), content.layers),
      theme = themeById(layer.theme);
    cameraView.prepare(physics, camera);
    avatar.position.set(...feet);
    let warmTime: SurfaceTime;
    do {
      const settings = options.settings();
      warmTime = settings.time;
      facilities.updateSurface(
        warmTime,
        performance.now() / 1000,
        settings.bakedShadows && feet[1] > -4,
      );
      environment.prepare({
        surface: theme.motif === "meadow",
        surfaceLightingActive: feet[1] > -4,
        time: warmTime,
        depth: layer.from,
        sky: theme.sky,
        groundLight: theme.groundLight,
        sceneryRevision: facilities.revision,
      });
      const warm = await prepareShaders(
        renderer,
        scene,
        camera,
        abort.signal,
        (done, total) => {
          onStatus(`正在准备材质 ${done}/${total}`);
          onLoading({ stage: "shaders", done, total });
        },
      );
      startup.warmupMs += warm.ms;
      startup.warmupPrograms += warm.newPrograms;
      startup.warmupObjects += warm.objects;
      startup.parallelShaderCompile = warm.parallel;
    } while (warmTime !== options.settings().time);
    check();
    await cameraGrade.prepare(renderer, abort.signal);
    check();
    onLoading({ stage: "shaders", done: 1, total: 1, complete: true });
    return {
      session,
      content,
      physics,
      terrain,
      interaction,
      player,
      facilities,
      sceneryCollision,
      environment,
      cameraView,
      cameraGrade,
      eggLabels,
      petFollowers,
      startup,
      timing: { status: 0, frames: 0 },
      dispose: () => {
        abort.abort();
        scope.dispose();
      },
    };
  } catch (error) {
    abort.abort(error);
    scope.dispose();
    throw error;
  }
}

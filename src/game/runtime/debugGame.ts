import type {
  Group,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { PreparedGame } from "./startGame.ts";
import type { GameSession } from "../application/GameSession.ts";
import type { GameInput } from "../GameInput.ts";
import type { Coord } from "../terrain/SparseWorld.ts";
import type { RenderRate } from "../movement.ts";
import type { ProbeMode } from "../presentation/PerformanceProbe.ts";
import type { PerformanceSnapshot } from "../presentation/PerformanceMeter.ts";
import type { RenderSubmission } from "../presentation/RenderSubmission.ts";
import type { RenderProfiler } from "../presentation/RenderProfiler.ts";
import { GAME_CONFIG } from "../config.ts";
import { COURSE_SPAWN } from "../validation/course.ts";
import { ORE_SAMPLES, mineralName } from "../terrain/minerals.ts";
export type ValidationDebug = {
  snapshot: () => unknown;
  performance: (options: {
    framesInFlight?: 1 | 2;
    submission?: "browser" | "fenced";
    reflection?: "live" | "frozen" | "off";
  }) => void;
  surfaceHeight: (x: number, z: number) => number | null;
  look: (yaw: number, pitch: number) => void;
  canMine: (coord: Coord) => boolean;
  cell: (coord: Coord) => number | null;
  mine: (coord: Coord) => boolean;
  mineMany: (coords: readonly Coord[]) => boolean;
  hit: GameSession["hit"];
  health: GameSession["blockHealth"];
  wireframe: (enabled: boolean) => void;
  teleport: (
    location:
      | "surface"
      | "deep"
      | "course"
      | "uniform"
      | "bands"
      | "checker"
      | readonly [number, number, number],
  ) => void;
};
declare global {
  interface Window {
    __miningValidation?: ValidationDebug;
  }
}

export function attachGameDebug(
  current: PreparedGame,
  gl: WebGLRenderer,
  scene: Scene,
  activeCamera: PerspectiveCamera,
  avatar: Group,
  sun: DirectionalLight,
  input: GameInput,
  session: GameSession,
  renderState: () => {
    rate: RenderRate;
    probe: ProbeMode;
    performance: PerformanceSnapshot | null;
    profiler: RenderProfiler | null;
    submission: RenderSubmission | null;
  },
) {
  const {
    physics,
    terrain,
    facilities,
    sceneryCollision,
    interaction,
    player,
    startup,
    environment,
    timing,
    cameraView,
  } = current;
  const teleport = player.travelTo;
  const debug: ValidationDebug = {
    snapshot: () => ({
      ...terrain.snapshot(),
      content: {
        layers: current.content.layers.map((l) => ({
          id: l.id,
          depth: l.from,
          theme: l.theme,
        })),
        rooms: current.content.rooms.map((r) => ({
          id: r.id,
          spawn: r.spawn,
          layout: r.layout,
        })),
        servicePlacements: current.content.surface.placements.filter(
          (p) =>
            p.asset === "simulator-exchange" || p.asset === "simulator-upgrade",
        ),
      },
      player: {
        height: GAME_CONFIG.player.height,
        radius: GAME_CONFIG.player.radius,
        cameraDistance: GAME_CONFIG.camera.distance,
      },
      startup: { ...startup, sky: environment?.sky.diagnostics() },
      travelling: !!player.travelling,
      facilities: {
        ...facilities.diagnostics(),
        colliders: sceneryCollision.count,
      },
      lighting: {
        shadowEnabled: gl.shadowMap.enabled,
        sunCastsShadow: sun?.castShadow,
        keyLight: {
          position: sun.position.toArray(),
          color: sun.color.getHexString(),
          intensity: sun.intensity,
        },
        shadowPolicy: "baked-ground-only",
        surfaceArea: environment?.lights.diagnostics(),
        cameraFar: (activeCamera as PerspectiveCamera).far,
        surfaceFog: !!scene.fog,
        lightingUpdates: environment?.updates ?? 0,
        shadowAutoUpdate: gl.shadowMap.autoUpdate,
        shadowMapSize: 0,
        shadowFilter: "none",
        surfaceReflections: environment?.sky.active ?? false,
      },
      cracks: interaction.cracks.diagnostics(),
      economy: session.getSnapshot(),
      pets: session.pets.getSnapshot(),
      eggLabels: current.eggLabels.diagnostics(),
      petFollowers: current.petFollowers.diagnostics(),
      combat: session.combatDebug(),
      sellZone: current.content.session.sales[0],
      samples: terrain.sampleStats(),
      terrainVisuals: terrain.render.diagnostics(),
      position: physics.feet(),
      grounded: physics.grounded,
      ready: !player.travelling && terrain.ready(physics.feet()),
      physicsSteps: physics.steps,
      jumps: physics.jumps,
      verticalSpeed: physics.verticalSpeed,
      droppedSeconds: player.fixed.droppedSeconds,
      renderedPosition: avatar?.position.toArray(),
      facing: avatar?.rotation.y,
      frames: timing.frames,
      renderer: {
        cameraGrade: current.cameraGrade.diagnostics(),
        programs: gl.info.programs?.length ?? 0,
        renderRate: renderState().rate,
        probeMode: renderState().probe,
        bufferSize: [gl.domElement.width, gl.domElement.height],
        pixelRatio: gl.getPixelRatio(),
        profile: renderState().profiler?.snapshot(),
        performance: renderState().performance,
        submission: renderState().submission?.snapshot(),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      },
      view: { ...cameraView.angles },
      camera: {
        ...cameraView.rig.snapshot(),
        obstructed: cameraView.rig.obstructed(physics.world, physics.collider),
      },
      aim: { ...input.getAim() },
      mineral: interaction.selected
        ? mineralName(terrain.cell(interaction.selected) ?? 0)
        : null,
      target: interaction.selected,
    }),
    performance: (options) => {
      if (options.submission)
        renderState().submission?.setMode(options.submission);
      if (options.framesInFlight)
        renderState().submission?.setMaxInFlight(options.framesInFlight);
      const profiler = renderState().profiler;
      if (options.reflection && profiler)
        profiler.reflectionMode = options.reflection;
    },
    surfaceHeight: (x, z) => facilities.surfaceHeight(x, z),
    look: (yaw, pitch) => cameraView.look(yaw, pitch),
    cell: (coord) => terrain.cell(coord),
    canMine: (coord) => terrain.canMine(coord),
    hit: session.hit,
    health: session.blockHealth,
    mine: (coord) => session.requestMine([coord]),
    mineMany: (coords) => session.requestMine(coords),
    wireframe: (enabled) => terrain.render.setWireframe(enabled),
    teleport: (location) => {
      const feet =
        location === "surface"
          ? current.content.returnPoint
          : location === "deep"
            ? current.content.rooms[current.content.rooms.length - 1].spawn
            : location === "course"
              ? COURSE_SPAWN
              : location === "uniform"
                ? ORE_SAMPLES[0].spawn
                : location === "bands"
                  ? ORE_SAMPLES[1].spawn
                  : location === "checker"
                    ? ORE_SAMPLES[2].spawn
                    : location;
      if (
        feet.some((v) => !Number.isFinite(v)) ||
        feet[0] < -95 ||
        feet[0] > 103 ||
        feet[2] < -95 ||
        feet[2] > 103 ||
        feet[1] < -3999 ||
        feet[1] > 20
      )
        throw new Error("验证位置超出矿区");
      teleport(feet);
    },
  };
  window.__miningValidation = debug;
  return () => {
    if (window.__miningValidation === debug) delete window.__miningValidation;
  };
}

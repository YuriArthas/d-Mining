import { Color } from "three";
import type {
  Group,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { gameAudio } from "../audio/GameAudio.ts";
import { SURFACE_EXPOSURE, type SurfaceLookOverride } from "../world/SceneLighting.ts";
import { applyToneGrade } from "../presentation/toneGrade.ts";
import { ARCHITECTURE_ALBEDO, setArchitectureAlbedo, setFoliageAlbedo } from "../presentation/albedoLift.ts";
import { setBakedLightTuning } from "../presentation/bakedLight.ts";
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
import { mineralName } from "../terrain/minerals.ts";
export type ValidationDebug = {
  advanceDayNight: (seconds: number) => void;
  advanceOnline: (seconds: number) => void;
  snapshot: () => unknown;
  performance: (options: {
    framesInFlight?: 1 | 2;
    submission?: "browser" | "fenced";
  }) => void;
  surfaceHeight: (x: number, z: number) => number | null;
  /** Try other surface light values and exposure live; null restores the game's. */
  lightingLook: (look: (SurfaceLookOverride & { exposure?: number; grade?: boolean; albedo?: { saturation: number; brightness: number; bounce?: number }; foliage?: { saturation?: number; brightness?: number; bounce?: number }; baked?: false | { shadow?: number; ao?: number; aoBuildings?: number; aoDirect?: number } }) | null) => void;
  /** Verification only: multiply the colour of every material whose name matches a rule (case-insensitive
   *  pattern, linear RGB factors), live; null restores the authored colours. Returns how many were tinted. */
  materialTint: (rules: readonly { match: string; color: readonly [number, number, number] }[] | null) => number;
  /** Final audio output level (dBFS) and a recordable stream of it, for checks. */
  audioLevel: () => number | null;
  audioStream: () => MediaStream | null;
  look: (yaw: number, pitch: number) => void;
  /** Clears cells straight through the terrain (no health, no loot): for looking at dug tunnels. */
  excavate: (coords: readonly Coord[]) => boolean;
  /** Slows the creek splashes (1 = normal) so screenshots can catch them. */
  splashTimeScale: (scale: number) => void;
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
  const tinted = new Map<MeshStandardMaterial, Color>();
  const debug: ValidationDebug = {
    advanceDayNight: seconds => environment.advanceDayNight(seconds),
    advanceOnline: seconds => session.advanceOnline(seconds),
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
      },
      player: {
        height: GAME_CONFIG.player.height,
        radius: GAME_CONFIG.player.radius,
        cameraDistance: GAME_CONFIG.camera.distance,
      },
      startup: { ...startup, sky: environment?.sky.diagnostics() },
      dayNight: environment.dayNightSnapshot,
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
        ambient: environment.ambientSnapshot,
        cameraDaylightBlend: environment.cameraDaylightBlend,
        shadowPolicy: "baked-light",
        surfaceArea: environment?.lights.diagnostics(),
        cameraFar: (activeCamera as PerspectiveCamera).far,
        surfaceFog: !!scene.fog,
        lightingUpdates: environment?.updates ?? 0,
      },
      cracks: interaction.cracks.diagnostics(),
      economy: session.getSnapshot(),
      pets: session.pets.getSnapshot(),
      eggLabels: current.eggLabels.diagnostics(),
      lockedEggs: current.lockedEggs.diagnostics(),
      caveLights: current.caveLights.diagnostics(),
      petFollowers: current.petFollowers.diagnostics(),
      avatar: current.minerAvatar.diagnostics(),
      feedback: { audio: gameAudio.diagnostics(), effects: current.feedback.effects.diagnostics(), splash: current.feedback.splash.diagnostics(), surface: current.feedback.surface(physics.feet()) },
      combat: session.combatDebug(),
      sellZone: current.content.session.sales[0],
      terrainVisuals: terrain.render.diagnostics(),
      position: physics.feet(),
      guideMining: {visible:interaction.lesson.group.visible,cell:interaction.lesson.cell},
      guideDirection: (() => {
        const arrow=scene.getObjectByName('onboarding-direction');
        return arrow?{style:arrow.userData.style,texture:arrow.userData.texture,visible:arrow.visible,position:arrow.position.toArray(),yaw:arrow.rotation.y,length:arrow.userData.length,destination:arrow.userData.destination}:null;
      })(),
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
    },
    surfaceHeight: (x, z) => facilities.surfaceHeight(x, z),
    lightingLook: look => {
      environment.setLookOverride(look ? { day: look.day, night: look.night } : null);
      gl.toneMappingExposure = look?.exposure ?? SURFACE_EXPOSURE;
      applyToneGrade(gl, look?.grade ?? true);
      const albedo = look?.albedo ?? ARCHITECTURE_ALBEDO;
      setArchitectureAlbedo(albedo.saturation, albedo.brightness, albedo.bounce ?? ARCHITECTURE_ALBEDO.bounce);
      setFoliageAlbedo(look?.foliage ?? null);
      // false: no baked light at all (for side-by-side checks); an object retunes it.
      setBakedLightTuning(look?.baked === false ? { shadow: 0, ao: 0, aoBuildings: 0 } : look?.baked ?? null);
    },
    materialTint: rules => {
      for (const [material, color] of tinted) material.color.copy(color);
      tinted.clear();
      for (const rule of rules ?? []) {
        const pattern = new RegExp(rule.match, "i"), factor = new Color(...rule.color);
        scene.traverse(object => {
          if (!(object as Mesh).isMesh) return;
          for (const material of [(object as Mesh).material].flat() as MeshStandardMaterial[]) {
            if (!material?.color || tinted.has(material) || !pattern.test(material.name)) continue;
            tinted.set(material, material.color.clone());
            material.color.multiply(factor);
          }
        });
      }
      return tinted.size;
    },
    audioLevel: () => gameAudio.outputLevel(),
    audioStream: () => gameAudio.outputStream(),
    look: (yaw, pitch) => cameraView.look(yaw, pitch),
    excavate: (coords) => terrain.mineMany(coords),
    splashTimeScale: scale => { current.feedback.splash.timeScale = scale; },
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
            : location;
      if (
        feet.some((v) => !Number.isFinite(v)) ||
        feet[0] < -95 ||
        feet[0] > 103 ||
        feet[2] < -95 ||
        feet[2] > 551 ||
        feet[1] < -2799 ||
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

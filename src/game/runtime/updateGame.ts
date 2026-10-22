import type { Group, Material, Mesh, PerspectiveCamera, WebGLRenderer } from "three";
import { surfaceLightStrengthAtFeet } from "../world/SurfaceLightFade.ts";
import { environmentDepthAtFeet, playerDepthAtFeet } from "../logic/PlayerDepth.ts";
import type { PreparedGame } from "./startGame.ts";
import type { GameInput } from "../GameInput.ts";
import type { LoadingEvent } from "../ui/loadingState.ts";
import type { SurfaceTime } from "../world/SceneLighting.ts";
import type { ProbeMode } from "../presentation/PerformanceProbe.ts";
import { stratumAtDepth } from "../terrain/strata.ts";
import { themeById } from "../content/themes.ts";
import { mineralName } from "../terrain/minerals.ts";
import { generationAtZ } from '../terrain/SparseWorld.ts';
export function updateGame(
  current: PreparedGame,
  elapsed: number,
  view: {
    camera: PerspectiveCamera;
    avatar: Group;
    fixtures: Group;
    contactShadow: Mesh | null;
  },
  input: GameInput,
  gl: WebGLRenderer,
  settings: {
    samples: boolean;
    timeOfDay: SurfaceTime | 'auto';
    sceneShadowsEnabled: boolean;
    probeMode: ProbeMode;
  },
  onStatus: (text: string) => void,
  onLoading: (event: LoadingEvent) => void,
) {
  if (current.session.suspended) { current.minerAvatar.cancelMining(); return; }
  const { camera, avatar, fixtures, contactShadow } = view;
  const { samples, timeOfDay, sceneShadowsEnabled, probeMode } = settings;
  const delta = Math.min(Math.max(elapsed, 0), 0.1);
  const onlineElapsed = document.hidden || current.timing.skipElapsed ? 0 : Math.min(Math.max(elapsed,0),1);
  current.timing.skipElapsed=false;
  if(current.startup.firstPlayableMs && onlineElapsed) current.session.advanceOnline(onlineElapsed);
  const start = performance.now(),
    {
      physics,
      terrain,
      player,
      interaction,
      cameraView,
      environment,
      startup,
      timing: clock,
    } = current;
  cameraView.consumeLook(input);
  clock.frames++;
  clock.status -= delta;
  try {
    const currentFeet = player.travelling ?? physics.feet();
    const sceneryStart = performance.now();
    if (!samples) current.sceneryCollision.sync(currentFeet);
    terrain.measurements.add(
      "sceneResidencyMs",
      performance.now() - sceneryStart,
    );
    const layer = stratumAtDepth(
        environmentDepthAtFeet(currentFeet, !player.travelling && physics.grounded, current.content.session.destinations),
        generationAtZ(terrain.world.generation,currentFeet[2]/2).layers,
      ),
      theme = themeById(layer.theme);
    const lightStrength = surfaceLightStrengthAtFeet(currentFeet[1]);
    gl.shadowMap.enabled = false;
    environment.update(
      {
        surface: theme.motif === "meadow",
        surfaceLightStrength: lightStrength,
        time: timeOfDay,
        depth: layer.from,
        sky: theme.sky,
        groundLight: theme.groundLight,
        sceneryRevision: current.facilities.revision,
      },
      delta,
      onlineElapsed,
    );
    current.facilities.updateSurface(
      environment.surfaceTime,
      performance.now() / 1000,
      sceneShadowsEnabled && probeMode !== "no-shadows",
      lightStrength,
      environment.daylightBlend,
    );
    physics.setSurfaceActive(
      currentFeet[1] > -48 &&
        Math.abs(currentFeet[0]) < 64 &&
        Math.abs(currentFeet[2] - 16) < 64,
    );
    player.step(elapsed, cameraView.angles.yaw, () => cameraView.rig.reset());
    if (
      !startup.firstPlayableMs &&
      !player.travelling &&
      terrain.ready(physics.feet()) &&
      physics.grounded
    )
      startup.firstPlayableMs = performance.now() - startup.started;
    const feet = physics.feet(),
      drawnFeet = physics.interpolatedFeet(player.fixed.alpha);
    fixtures.visible = feet[1] > -64;
    if (contactShadow)
      contactShadow.visible = lightStrength > 0 && physics.grounded;
    cameraView.update(
      physics,
      drawnFeet,
      player.facing,
      avatar,
      contactShadow,
      camera as PerspectiveCamera,
      delta,
    );
    if (contactShadow)
      (contactShadow.material as Material).opacity = cameraView.rig.avatarOpacity * lightStrength;
    current.petFollowers.update(drawnFeet, player.facing, camera, delta, !!player.travelling, physics.grounded);
    interaction.update(
      camera as PerspectiveCamera,
      feet,
      !!player.travelling,
      input,
      terrain,
    );
    if(interaction.strike)current.minerAvatar.strike(interaction.strike.target,interaction.strike.speed);
    current.minerAvatar.update(drawnFeet, delta, physics.grounded, !!player.travelling);
    current.feedback.update(delta, interaction.strike, current.minerAvatar.consumeEvents(), drawnFeet);
    const selected = interaction.selected;
    if (clock.status <= 0) {
      const info = terrain.snapshot();
      const depth = Math.floor(playerDepthAtFeet(feet, physics.grounded, current.content.session.destinations));
      const currentLayer = stratumAtDepth(environmentDepthAtFeet(feet, physics.grounded, current.content.session.destinations), generationAtZ(terrain.world.generation,feet[2]/2).layers);
      onStatus(
        terrain.error ??
          (player.travelling || !terrain.ready(feet)
            ? "正在准备附近地形"
            : `${current.content.worlds?`世界 ${current.session.getSnapshot().currentWorld} · `:''}深度 ${depth} 米 · ${currentLayer.name}${selected ? " · " + mineralName(terrain.cell(selected) ?? 0) : ""}`),
      );
      clock.status = 0.25;
    }
    terrain.measurements.add("frameCpuMs", performance.now() - start);
    terrain.measurements.add("frameIntervalMs", elapsed * 1000);
  } catch (reason) {
    const error = `运行失败：${String(reason)}`;
    onStatus(error);
    onLoading({ error });
    throw reason;
  }
}

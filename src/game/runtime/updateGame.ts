import type { Group, Mesh, PerspectiveCamera, WebGLRenderer } from "three";
import type { PreparedGame } from "./startGame.ts";
import type { GameInput } from "../GameInput.ts";
import type { LoadingEvent } from "../ui/loadingState.ts";
import type { SurfaceTime } from "../world/SceneLighting.ts";
import type { ProbeMode } from "../presentation/PerformanceProbe.ts";
import { stratumAtDepth } from "../terrain/strata.ts";
import { themeById } from "../content/themes.ts";
import { mineralName } from "../terrain/minerals.ts";
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
    timeOfDay: SurfaceTime;
    sceneShadowsEnabled: boolean;
    probeMode: ProbeMode;
  },
  onStatus: (text: string) => void,
  onLoading: (event: LoadingEvent) => void,
) {
  const { camera, avatar, fixtures, contactShadow } = view;
  const { samples, timeOfDay, sceneShadowsEnabled, probeMode } = settings;
  const delta = Math.min(Math.max(elapsed, 0), 0.1);
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
        Math.max(0, -currentFeet[1] + 0.04),
        current.content.layers,
      ),
      theme = themeById(layer.theme);
    const surfaceLightingActive = currentFeet[1] > -4;
    current.facilities.updateSurface(
      timeOfDay,
      performance.now() / 1000,
      sceneShadowsEnabled &&
        surfaceLightingActive &&
        probeMode !== "no-shadows",
    );
    gl.shadowMap.enabled = false;
    environment.update(
      {
        surface: theme.motif === "meadow",
        surfaceLightingActive,
        time: timeOfDay,
        depth: layer.from,
        sky: theme.sky,
        groundLight: theme.groundLight,
        sceneryRevision: current.facilities.revision,
      },
      delta,
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
      contactShadow.visible = surfaceLightingActive && physics.grounded;
    cameraView.update(
      physics,
      drawnFeet,
      player.facing,
      avatar,
      contactShadow,
      camera as PerspectiveCamera,
      delta,
    );
    current.petFollowers.update(drawnFeet, player.facing, camera, delta, !!player.travelling);
    interaction.update(
      camera as PerspectiveCamera,
      feet,
      !!player.travelling,
      input,
      terrain,
    );
    const selected = interaction.selected;
    if (clock.status <= 0) {
      const info = terrain.snapshot();
      onStatus(
        terrain.error ??
          (player.travelling || !terrain.ready(feet)
            ? "正在准备附近地形"
            : `深度 ${Math.max(0, Math.round(-feet[1]))} 米 · ${stratumAtDepth(Math.max(0, Math.round(-feet[1])), current.content.layers).name} · 已挖 ${info.committedEdits}${selected ? " · " + mineralName(terrain.cell(selected) ?? 0) : ""}`),
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

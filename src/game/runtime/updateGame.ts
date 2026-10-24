import type { Group, Material, Mesh, PerspectiveCamera, WebGLRenderer } from "three";
import { surfaceLightStrengthAtFeet } from "../world/SurfaceLightFade.ts";
import { environmentDepthAtFeet, playerDepthAtFeet } from "../logic/PlayerDepth.ts";
import type { PreparedGame } from "./startGame.ts";
import type { GameInput } from "../GameInput.ts";
import type { LoadingEvent } from "../ui/loadingState.ts";
import type { ProbeMode } from "../presentation/PerformanceProbe.ts";
import { stratumAtDepth } from "../terrain/strata.ts";
import { themeById } from "../content/themes.ts";
import { HALL_BY_LAYER, undergroundHall } from "../content/underground/halls.ts";
import { mineralName } from "../terrain/minerals.ts";
import { generationAtZ } from '../terrain/SparseWorld.ts';
import { Vector3 } from "three";
import { bakedLightState, bakedSunAlignment, bakedSunDirection, setStandingSun } from '../presentation/bakedLight.ts';
import { standingSun } from '../presentation/standingLight.ts';
export function updateGame(
  current: PreparedGame,
  elapsed: number,
  view: {
    camera: PerspectiveCamera;
    avatar: Group;
    contactShadow: Mesh | null;
    sunShadow?: Group | null;
  },
  input: GameInput,
  gl: WebGLRenderer,
  settings: {
    sceneShadowsEnabled: boolean;
    probeMode: ProbeMode;
  },
  onStatus: (text: string) => void,
  onLoading: (event: LoadingEvent) => void,
) {
  if (current.session.suspended) { current.minerAvatar.cancelMining(); return; }
  const { camera, avatar, contactShadow, sunShadow } = view;
  const { sceneShadowsEnabled, probeMode } = settings;
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
    current.sceneryCollision.sync(currentFeet);
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
    current.feedback.place({ theme: layer.theme, surfaceLight: lightStrength });
    gl.shadowMap.enabled = false;
    environment.update(
      {
        surface: theme.motif === "meadow",
        surfaceLightStrength: lightStrength,
        depth: layer.from,
        sky: theme.sky,
        groundLight: theme.groundLight,
        sceneryRevision: current.facilities.revision,
        cave: HALL_BY_LAYER[layer.id] ? undergroundHall(HALL_BY_LAYER[layer.id]).hall.look : undefined,
      },
      delta,
    );
    current.facilities.updateSurface(performance.now() / 1000, sceneShadowsEnabled && probeMode !== "no-shadows");
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
    updateMinerSunlight(avatar, sunShadow ?? null, drawnFeet, environment, lightStrength * (physics.grounded ? 1 : 0), cameraView.rig.avatarOpacity);
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
    current.stations?.update(delta);
    current.motion?.update(delta);
    current.caveLights.update(drawnFeet, layer.id, lightStrength);
    const selected = interaction.selected;
    if (clock.status <= 0) {
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

const keyDirection = new Vector3();
/** On the surface the miner takes the baked sun at its feet (darker in shade) and casts a decal shadow along the
 *  baked sun's direction, faded in shade, underground and with shadows switched off. */
function updateMinerSunlight(avatar: Group, sunShadow: Group | null, feet: readonly number[], environment: PreparedGame['environment'], strength: number, opacity: number) {
  const baked = bakedLightState().active, sun = baked ? standingSun(feet[0], feet[1], feet[2]) : 1;
  setStandingSun(sun);
  if (!sunShadow) return;
  const shown = baked ? bakedSunAlignment(environment.keyDirection(keyDirection)) * sun * strength * opacity : 0;
  sunShadow.visible = shown > .01;
  if (!sunShadow.visible) return;
  const toward = bakedSunDirection(), across = Math.hypot(toward.x, toward.z);
  // Local -Z points along the shadow (away from the sun); the decal is as long as a 1.75 m body's shadow.
  sunShadow.rotation.y = Math.atan2(toward.x, toward.z) - avatar.rotation.y;
  const decal = sunShadow.children[0] as Mesh, length = 1.75 * across / Math.max(.2, toward.y);
  decal.scale.y = length + .3; decal.position.z = -(length + .3) / 2 + .2;
  (decal.material as Material).opacity = .56 * shown;
}
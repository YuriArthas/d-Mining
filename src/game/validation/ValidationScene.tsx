import type { ShopView } from '../presentation/ShopView.ts';
import { GuideMarkerProjector } from '../presentation/GuideMarkerProjector.ts';
import { GuideDirectionArrow, updateGuideRoute } from '../presentation/GuideDirectionArrow.tsx';
import type { SavedGame } from '../persistence/SaveBootstrap.ts';
import { blendedCameraLook } from '../content/cameraLook.ts';
import type { GameContent } from "../content/gameContent.ts";
import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  HemisphereLight,
  DirectionalLight,
} from "three";
import { startGame, type PreparedGame } from "../runtime/startGame.ts";
import { updateGame } from "../runtime/updateGame.ts";
import { attachGameDebug } from "../runtime/debugGame.ts";
import { RenderSchedule, type RenderRate } from "../movement.ts";
import { RenderSubmission } from "../presentation/RenderSubmission.ts";
import { RenderProfiler } from "../presentation/RenderProfiler.ts";
import {
  PerformanceMeter,
  type PerformanceSnapshot,
} from "../presentation/PerformanceMeter.ts";
import type { ProbeMode } from "../presentation/PerformanceProbe.ts";
import type { LoadingEvent } from "../ui/loadingState.ts";
import type { SurfaceTime } from "../world/SceneLighting.ts";
import type { GameInput } from "../GameInput.ts";
import type { GameSession } from "../application/GameSession.ts";
import { ContactShadow } from "../presentation/ContactShadow.tsx";
import {
  compileStableShadow,
  SHADOW_FILTER_ID,
} from "../presentation/stableShadow.ts";
import { GAME_CONFIG } from "../config.ts";

export function ValidationScene({
  content,
  shopView,
  savedGame,
  renderRate,
  shadowsEnabled: sceneShadowsEnabled,
  probeMode,
  input,
  onStatus,
  onLoading,
  onPerformance,
  session,
  timeOfDay,
  stylized,
  guideMarker,
}: {
  shopView: ShopView;
  guideMarker: RefObject<HTMLDivElement | null>;
  content: GameContent;
  savedGame: SavedGame;
  renderRate: RenderRate;
  shadowsEnabled: boolean;
  probeMode: ProbeMode;
  timeOfDay: SurfaceTime | 'auto';
  stylized: boolean;
  input: GameInput;
  onStatus: (text: string) => void;
  onLoading: (event: LoadingEvent) => void;
  onPerformance: (value: PerformanceSnapshot) => void;
  session: GameSession;
}) {
  const params = new URLSearchParams(location.search);
  const root = useRef<Group>(null),
    avatar = useRef<Group>(null);
  const runtime = useRef<PreparedGame | null>(null);
  const contactShadow = useRef<Mesh>(null);
  const sunShadow = useRef<Group>(null);
  const loadingReleased = useRef(false);
  const guideProjector = useRef(new GuideMarkerProjector());
  const guideArrow = useRef<Group>(null);
  const settings = useRef({ timeOfDay, sceneShadowsEnabled });
  settings.current = { timeOfDay, sceneShadowsEnabled };
  const { advance, gl, scene, camera: activeCamera } = useThree();
  const activeRate = useRef(renderRate);
  activeRate.current = renderRate;
  const activeProbe = useRef(probeMode);
  activeProbe.current = probeMode;
  const unlit = useRef<MeshBasicMaterial | null>(null);
  const submission = useRef<RenderSubmission | null>(null);
  const profiler = useRef<RenderProfiler | null>(null);
  const latestPerformance = useRef<PerformanceSnapshot | null>(null);
  const ambient = useRef<HemisphereLight>(null),
    sun = useRef<DirectionalLight>(null);

  useEffect(() => {
    const controller = new AbortController();
    let detachDebug = () => {};
    loadingReleased.current = false;
    onLoading({ reset: true });
    startGame({
      content,
      renderer: gl,
      scene,
      root: root.current!,
      ambient: ambient.current!,
      sun: sun.current!,
      camera: activeCamera as PerspectiveCamera,
      avatar: avatar.current!,
      input,
      session,
      restoredWorld: savedGame.world,
      previewLayer: params.get("debug") === "1" ? params.get("layer") : null,
      signal: controller.signal,
      settings: () => ({
        time: settings.current.timeOfDay,
        bakedShadows: settings.current.sceneShadowsEnabled,
      }),
      onStatus,
      onLoading,
    })
      .then((game) => {
        if (controller.signal.aborted) {
          game.dispose();
          return;
        }
        runtime.current = game;
        if (params.get("debug") === "1")
          detachDebug = attachGameDebug(
            game,
            gl,
            scene,
            activeCamera as PerspectiveCamera,
            avatar.current!,
            sun.current!,
            input,
            session,
            () => ({
              rate: activeRate.current,
              probe: activeProbe.current,
              performance: latestPerformance.current,
              profiler: profiler.current,
              submission: submission.current,
            }),
          );
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        savedGame.saves.invalidate(reason);
        const error = `初始化失败：${String(reason)}`;
        onStatus(error);
        onLoading({ error });
      });
    return () => {
      detachDebug();
      controller.abort();
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [content, input, gl, scene, onStatus, onLoading, session, savedGame]);

  useEffect(() => {
    const basic = new MeshBasicMaterial({ color: "#a0a0a0" });
    unlit.current = basic;
    const context = gl.getContext();
    if (!("fenceSync" in context)) throw new Error("需要 WebGL2 绘制同步支持");
    const gate = new RenderSubmission(
      context,
      new URLSearchParams(location.search).get("framesInFlight") === "1"
        ? 1
        : 2,
      new URLSearchParams(location.search).get("submission") === "fenced"
        ? "fenced"
        : "browser",
    );
    submission.current = gate;
    const profile = new RenderProfiler(
      gl,
      new URLSearchParams(location.search).get("gpuTiming") === "1",
    );
    profiler.current = profile;
    profile.scissorEnabled =
      new URLSearchParams(location.search).get("reflectionScissor") !== "0";
    const reflectionMode = new URLSearchParams(location.search).get(
      "reflection",
    );
    if (reflectionMode === "live" || reflectionMode === "frozen")
      profile.reflectionMode = reflectionMode;
    return () => {
      basic.dispose();
      unlit.current = null;
      profile.dispose();
      profiler.current = null;
      gate.dispose();
      if (submission.current === gate) submission.current = null;
    };
  }, [gl]);

  // Priority 1 owns drawing; ordinary useFrame callbacks still simulate every
  // scheduled tick, including when the GPU has not completed its previous draw.
  useFrame(({ gl, scene, camera }, delta) => {
    if (!runtime.current || probeMode === "idle") return;
    try {
      const current = runtime.current;
      let drewWorld = false;
      const submitted = submission.current?.draw(() => {
        runtime.current?.facilities.beginSurfaceDraw();
        const autoReset = gl.info.autoReset;
        gl.info.autoReset = false;
        gl.info.reset();
        profiler.current?.beginFrame();
        const override = scene.overrideMaterial;
        if (probeMode === "unlit") scene.overrideMaterial = unlit.current;
        try {
          // Environment cubemap/PMREM draws share the same admission and fence
          // as the world frame and finish before any material samples them.
          if (shopView.render(gl, delta)) return;
          current.environment.prepareDraw();
          drewWorld = true;
          current.cameraGrade.draw(gl, scene, camera, stylized && probeMode !== "unlit", blendedCameraLook(current.environment.cameraDaylightBlend));
        } finally {
          scene.overrideMaterial = override;
          profiler.current?.endFrame();
          gl.info.autoReset = autoReset;
        }
      });
      if (submitted && drewWorld) current.environment.markSubmitted();
    } catch (reason) {
      const error = `渲染失败：${String(reason)}`;
      onStatus(error);
      onLoading({ error });
      throw reason;
    }
  }, 1);

  useEffect(() => {
    let id = 0;
    const schedule = new RenderSchedule(),
      meter = new PerformanceMeter();
    const frame = (now: number) => {
      // One RAF owner; render cap is independent from fixed 60 Hz physics.
      const scheduled = schedule.due(now, activeRate.current);
      meter.recordRaf(scheduled);
      if (scheduled) {
        const before = submission.current?.submitted ?? 0,
          start = performance.now();
        advance(now / 1000);
        if (
          !loadingReleased.current &&
          runtime.current?.startup.firstPlayableMs &&
          (submission.current?.submitted ?? 0) > before
        ) {
          loadingReleased.current = true;
          input.reset();
          onLoading({ ready: true });
        }
        const end = performance.now(),
          cpuMs = end - start;
        runtime.current?.terrain.measurements.add("mainFrameMs", cpuMs);
        const stats = meter.record(
          end,
          cpuMs,
          (submission.current?.submitted ?? 0) > before,
          gl.info.render.calls,
          gl.info.render.triangles,
          profiler.current?.snapshot(),
          submission.current?.waitCpuMs ?? 0,
          activeProbe.current === "idle",
        );
        if (stats) {
          latestPerformance.current = stats;
          onPerformance(stats);
        }
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [advance, gl, onPerformance, onLoading, input]);

  useFrame(({ camera }, elapsed) => {
    const game = runtime.current;
    if (!game || !avatar.current) return;
    const gear = session.getSnapshot();
    game.minerAvatar.setEquipment(gear.pickaxe.level, gear.backpackLevel);
    if (shopView.active) {
      input.reset(); game.minerAvatar.cancelMining();
      if (guideArrow.current) guideArrow.current.visible = false;
      if (guideMarker.current) guideMarker.current.style.visibility = 'hidden';
      if (!document.hidden && !session.suspended) session.advanceOnline(Math.min(Math.max(elapsed, 0), 1));
      return;
    }
    try { updateGame(
      game,
      elapsed,
      {
        camera: camera as PerspectiveCamera,
        avatar: avatar.current,
        contactShadow: contactShadow.current,
        sunShadow: sunShadow.current,
      },
      input,
      gl,
      { timeOfDay, sceneShadowsEnabled, probeMode },
      onStatus,
      onLoading,
    );
    } catch (error) { savedGame.saves.invalidate(error); throw error; }
    if (game.terrain.error) savedGame.saves.invalidate(game.terrain.error);
    const tipState = session.getSnapshot(), tip = tipState.tip;
    // First-dig tip: an arrow to the mine on the surface, then a glowing block once there.
    if (tip?.anchor === 'mine') guideProjector.current.update(camera, tipState.tipAnchor, guideMarker.current);
    game.interaction.lesson.update(camera as PerspectiveCamera, game.physics.feet(), game.interaction.selected, game.terrain, tipState.pickaxe.level, guideMarker.current, tip?.anchor === 'dig' && !game.player.travelling && !session.suspended);
    const arrow = guideArrow.current, target = tip?.anchor === 'mine' ? tipState.tipAnchor : null;
    if (arrow) {
      const feet = avatar.current.position;
      const dx = target ? target[0] - feet.x : 0, dz = target ? target[2] - feet.z : 0;
      const distance = Math.hypot(dx, dz);
      arrow.visible = !!target && !!guideMarker.current && !game.player.travelling && distance > 2;
      if (arrow.visible) {
        updateGuideRoute(arrow,feet.toArray(),target!);
      }
      if (guideMarker.current) guideMarker.current.dataset.directionVisible = String(arrow.visible);
    }
  });

  return (
    <group ref={root}>
      <GuideDirectionArrow arrowRef={guideArrow} />
      <hemisphereLight ref={ambient} args={["#eef4ef", "#718574", 1.15]} />
      <directionalLight
        ref={sun}
        castShadow={false}
        position={[-24, 42, 20]}
        color="#ffefd5"
        intensity={2.5}
      />
      <group ref={avatar}>
        <ContactShadow shadowRef={contactShadow} sunShadowRef={sunShadow} />
      </group>
    </group>
  );
}

import type { CampContent } from "../content/campContent.ts";
import { useEffect, useRef } from "react";
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
import { BOXES, RAMP } from "./physics.ts";

export function ValidationScene({
  content,
  renderRate,
  shadowsEnabled: sceneShadowsEnabled,
  probeMode,
  input,
  onStatus,
  onLoading,
  onPerformance,
  session,
  timeOfDay,
}: {
  content: CampContent;
  renderRate: RenderRate;
  shadowsEnabled: boolean;
  probeMode: ProbeMode;
  timeOfDay: SurfaceTime;
  input: GameInput;
  onStatus: (text: string) => void;
  onLoading: (event: LoadingEvent) => void;
  onPerformance: (value: PerformanceSnapshot) => void;
  session: GameSession;
}) {
  const params = new URLSearchParams(location.search),
    samples = params.get("debug") === "1" && params.get("samples") === "1";
  const surfaceBoxes = samples ? BOXES : [],
    ramp = samples ? RAMP : null;
  const root = useRef<Group>(null),
    avatar = useRef<Group>(null),
    fixtures = useRef<Group>(null);
  const runtime = useRef<PreparedGame | null>(null);
  const contactShadow = useRef<Mesh>(null);
  const loadingReleased = useRef(false);
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
      samples,
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
  }, [content, input, gl, scene, onStatus, onLoading, session]);

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
  useFrame(({ gl, scene, camera }) => {
    if (!runtime.current || probeMode === "idle") return;
    try {
      submission.current?.draw(() => {
        runtime.current?.facilities.beginSurfaceDraw();
        const autoReset = gl.info.autoReset;
        gl.info.autoReset = false;
        gl.info.reset();
        profiler.current?.beginFrame();
        const override = scene.overrideMaterial;
        if (probeMode === "unlit") scene.overrideMaterial = unlit.current;
        try {
          gl.render(scene, camera);
        } finally {
          scene.overrideMaterial = override;
          profiler.current?.endFrame();
          gl.info.autoReset = autoReset;
        }
      });
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
    if (!game || !avatar.current || !fixtures.current) return;
    updateGame(
      game,
      elapsed,
      {
        camera: camera as PerspectiveCamera,
        avatar: avatar.current,
        fixtures: fixtures.current,
        contactShadow: contactShadow.current,
      },
      input,
      gl,
      { samples, timeOfDay, sceneShadowsEnabled, probeMode },
      onStatus,
      onLoading,
    );
  });

  return (
    <group ref={root}>
      <hemisphereLight ref={ambient} args={["#eef4ef", "#718574", 1.15]} />
      <directionalLight
        ref={sun}
        castShadow={false}
        position={[-24, 42, 20]}
        color="#ffefd5"
        intensity={2.5}
      />
      <group ref={fixtures}>
        {surfaceBoxes.map((box, i) => (
          <mesh
            receiveShadow
            key={i}
            position={box.center as [number, number, number]}
          >
            <boxGeometry
              args={box.half.map((v) => v * 2) as [number, number, number]}
            />
            <meshStandardMaterial
              color={box.color}
              roughness={1}
              onBeforeCompile={compileStableShadow}
            />
          </mesh>
        ))}
        {ramp && (
          <mesh castShadow receiveShadow>
            <bufferGeometry onUpdate={(g) => g.computeVertexNormals()}>
              <bufferAttribute
                attach="attributes-position"
                args={[ramp.positions, 3]}
              />
              <bufferAttribute attach="index" args={[ramp.indices, 1]} />
            </bufferGeometry>
            <meshStandardMaterial
              color="#dfd0ad"
              roughness={0.85}
              flatShading
              onBeforeCompile={compileStableShadow}
              customProgramCacheKey={() => `ramp-${SHADOW_FILTER_ID}`}
            />
          </mesh>
        )}
      </group>
      <group ref={avatar}>
        <ContactShadow shadowRef={contactShadow} />
        <mesh receiveShadow position={[0, GAME_CONFIG.player.height / 2, 0]}>
          <cylinderGeometry
            args={[
              GAME_CONFIG.player.radius,
              GAME_CONFIG.player.radius,
              GAME_CONFIG.player.height,
              32,
            ]}
          />
          <meshStandardMaterial
            color="#f0b45b"
            roughness={0.9}
            onBeforeCompile={compileStableShadow}
            customProgramCacheKey={() => `avatar-${SHADOW_FILTER_ID}`}
            transparent
          />
        </mesh>
        <mesh
          position={[0, GAME_CONFIG.player.height + 0.005, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <circleGeometry args={[0.23, 3]} />
          <meshBasicMaterial color="#253d45" transparent />
        </mesh>
      </group>
    </group>
  );
}

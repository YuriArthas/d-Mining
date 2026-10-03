import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Raycaster, Vector2, Mesh, Material, PerspectiveCamera } from 'three';
import { GAME_CONFIG } from '../config.ts';
import type { GameInput } from '../GameInput.ts';
import { CharacterPhysics, initPhysics, BOXES, RAMP, PLAYER } from './physics.ts';
import { FixedStepClock, RenderSchedule, MOVEMENT } from '../movement.ts';
import { ThirdPersonCamera } from '../ThirdPersonCamera.ts';
import { COURSE_SPAWN } from './course.ts';
import { TerrainStream } from './TerrainStream.ts';
import { ORE_SAMPLES, mineralName } from '../terrain/minerals.ts';
import { selectCell } from '../terrain/selection.ts';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';
import type { GameSession } from '../application/GameSession.ts';
import { BlockCracks } from '../presentation/BlockCracks.ts';
import { SELL_ZONE, SURFACE_RETURN } from '../application/items.ts';

export type ValidationDebug = {
  snapshot: () => unknown;
  cell: (coord: Coord) => number | null;
  mine: (coord: Coord) => boolean;
  mineMany: (coords: readonly Coord[]) => boolean;
  hit: GameSession['hit'];
  health: GameSession['blockHealth'];
  wireframe: (enabled: boolean) => void;
  teleport: (location: 'surface' | 'deep' | 'course' | 'uniform' | 'bands' | 'checker' | readonly [number, number, number]) => void;
};
declare global { interface Window { __miningValidation?: ValidationDebug } }

export function ValidationScene({ input, onStatus, session }: { input: GameInput; onStatus: (text: string) => void; session: GameSession }) {
  const root = useRef<Group>(null), avatar = useRef<Group>(null), fixtures = useRef<Group>(null);
  const runtime = useRef<{ physics: CharacterPhysics; terrain: TerrainStream; cracks: BlockCracks } | null>(null);
  const view = useRef({ yaw: Number(GAME_CONFIG.camera.initialYaw), pitch: Number(GAME_CONFIG.camera.initialPitch) });
  const followCamera = useRef(new ThirdPersonCamera());
  const fixed = useRef(new FixedStepClock());
  const facing = useRef(0);
  const timing = useRef({ status: 0, frames: 0 });
  const marker = useRef<LineSegments | null>(null);
  const error = useRef<string | null>(null);
  const pickPoint = useRef(new Vector2());
  const pickRay = useRef(new Raycaster());
  const selection = useRef<Coord | null>(null);
  const { advance, gl } = useThree();

  useEffect(() => {
    let cancelled = false;
    let detach = () => {};
    let detachDamage = () => {};
    onStatus('正在准备地形');
    initPhysics().then(() => {
      if (cancelled) return;
      const physics = new CharacterPhysics(), terrain = new TerrainStream(physics, undefined, session.collected);
      const teleport = (feet: readonly number[]) => {
        input.reset(); terrain.relocate(feet); physics.teleport(feet); fixed.current.reset(); followCamera.current.reset(); session.resetPosition();
      };
      detach = session.attach({ cell: cell => terrain.cell(cell), pending: cell => terrain.pending(cell), mine: targets => terrain.mineMany(targets), cancelMining: () => terrain.cancelPending(), returnToSurface: () => teleport(SURFACE_RETURN) });
      const cracks = new BlockCracks(); detachDamage = session.observeBlockDamage(cracks.setDamage); root.current!.add(cracks.group);
      runtime.current = { physics, terrain, cracks }; root.current!.add(terrain.group); terrain.recenter(physics.feet());
      const box = new BoxGeometry(CELL + 0.015, CELL + 0.015, CELL + 0.015);
      const outline = new LineSegments(new EdgesGeometry(box), new LineBasicMaterial({ color: '#fff0ae' })); box.dispose();
      outline.visible = false; marker.current = outline; root.current!.add(outline);
      if (new URLSearchParams(location.search).get('debug') === '1') {
        window.__miningValidation = {
          snapshot: () => ({ ...terrain.snapshot(), cracks: cracks.diagnostics(), economy: session.getSnapshot(), combat: session.combatDebug(), sellZone: SELL_ZONE, samples: terrain.sampleStats(), terrainVisuals: terrain.render.diagnostics(), position: physics.feet(), grounded: physics.grounded, ready: terrain.ready(physics.feet()), physicsSteps: physics.steps, jumps: physics.jumps, verticalSpeed: physics.verticalSpeed, droppedSeconds: fixed.current.droppedSeconds, renderedPosition: avatar.current?.position.toArray(), facing: avatar.current?.rotation.y, frames: timing.current.frames, renderer: { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }, view: { ...view.current }, camera: { ...followCamera.current.snapshot(), obstructed: followCamera.current.obstructed(physics.world, physics.collider) }, aim: { ...input.getAim() }, mineral: selection.current ? mineralName(terrain.cell(selection.current) ?? 0) : null, target: selection.current }),
          cell: coord => terrain.cell(coord),
          hit: session.hit, health: session.blockHealth,
          mine: coord => session.requestMine([coord]),
          mineMany: coords => session.requestMine(coords),
          wireframe: enabled => terrain.render.setWireframe(enabled),
          teleport: location => {
            const feet = location === 'surface' ? PLAYER.spawn : location === 'deep' ? [0, -1999.9, 0] : location === 'course' ? COURSE_SPAWN : location === 'uniform' ? ORE_SAMPLES[0].spawn : location === 'bands' ? ORE_SAMPLES[1].spawn : location === 'checker' ? ORE_SAMPLES[2].spawn : location;
            if (feet.some(v => !Number.isFinite(v)) || feet[0] < -95 || feet[0] > 103 || feet[2] < -95 || feet[2] > 103 || feet[1] < -3999 || feet[1] > 20) throw new Error('验证位置超出矿区');
            teleport(feet);
          },
        };
      }
    }).catch(reason => { error.current = `初始化失败：${String(reason)}`; onStatus(error.current); });
    return () => {
      cancelled = true; detachDamage(); detach(); delete window.__miningValidation;
      const current = runtime.current; runtime.current = null;
      if (current) { current.cracks.group.removeFromParent(); current.cracks.dispose(); current.terrain.group.removeFromParent(); current.terrain.dispose(); current.physics.dispose(); }
      if (marker.current) { marker.current.removeFromParent(); marker.current.geometry.dispose(); (marker.current.material as LineBasicMaterial).dispose(); marker.current = null; }
    };
  }, [input, gl, onStatus, session]);

  useEffect(() => {
    let id = 0; const schedule = new RenderSchedule();
    const frame = (now: number) => {
      // One owner of the frame loop; cap actual rendering even on 90/120 Hz displays.
      if (schedule.due(now)) {
        const start = performance.now(); advance(now / 1000);
        runtime.current?.terrain.measurements.add('mainFrameMs', performance.now() - start);
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [advance]);

  useFrame(({ camera }, elapsed) => {
    const delta = Math.min(Math.max(elapsed, 0), 0.1), look = input.consumeLook(), settings = GAME_CONFIG.camera;
    view.current.yaw = (view.current.yaw - look.x) % (Math.PI * 2);
    view.current.pitch = Math.max(settings.minPitch, Math.min(settings.maxPitch, view.current.pitch + look.y));
    const current = runtime.current;
    if (!current || !avatar.current) return;
    const start = performance.now(), { physics, terrain } = current, clock = timing.current;
    clock.frames++; clock.status -= delta;
    try {
      let processedTerrain = false;
      const currentFeet = physics.feet();
      physics.setSurfaceActive(currentFeet[1] > -48 && Math.abs(currentFeet[0]) < 64 && Math.abs(currentFeet[2] - 16) < 64);
      fixed.current.advance(elapsed, () => {
        const state = input.getSnapshot(); terrain.recenter(physics.feet());
        // Commit only immediately before a physics step: Rapier refreshes scene
        // queries in step(). Frames without a logic step defer resource installation.
        if (!processedTerrain) { terrain.process(); processedTerrain = true; }
        physics.tick(state.moveX, state.moveY, view.current.yaw, input.consumeJump(), terrain.ready(physics.feet()));
        session.updatePosition(physics.feet(), physics.grounded);
        if (state.moveX || state.moveY) facing.current = view.current.yaw + Math.atan2(-state.moveX, state.moveY);
      });
      const feet = physics.feet(), drawnFeet = physics.interpolatedFeet(fixed.current.alpha);
      const turn = Math.atan2(Math.sin(facing.current - avatar.current.rotation.y), Math.cos(facing.current - avatar.current.rotation.y));
      avatar.current.rotation.y += turn * (1 - Math.exp(-MOVEMENT.turnSharpness * delta));
      avatar.current.position.set(...drawnFeet); fixtures.current!.visible = feet[1] > -64;
      const rig = followCamera.current, lens = camera as PerspectiveCamera;
      rig.update(physics.world, physics.collider, drawnFeet, view.current.yaw, view.current.pitch, delta, lens.aspect);
      if (lens.near !== rig.near) { lens.near = rig.near; lens.updateProjectionMatrix(); }
      camera.position.copy(rig.position);
      camera.lookAt(rig.position.clone().sub(rig.direction));
      avatar.current.visible = rig.avatarOpacity > 0.001;
      avatar.current.traverse(object => {
        if (object instanceof Mesh) {
          const material = object.material as Material;
          material.opacity = rig.avatarOpacity;
          material.depthWrite = rig.avatarOpacity >= 1;
        }
      });
      const selectionStart = performance.now(), press = input.consumeMinePress(), aim = press ?? input.getAim();
      let selected: Coord | null = null;
      if (aim.active && terrain.ready(feet)) {
        // lookAt changes the local transform; picking must use this frame's camera.
        camera.updateMatrixWorld();
        pickRay.current.setFromCamera(pickPoint.current.set(aim.x, aim.y), lens);
        const { origin, direction } = pickRay.current.ray;
        selected = selectCell(origin.toArray(), direction.toArray(), [feet[0], feet[1] + 1, feet[2]],
          cell => terrain.cell(cell));
      }
      terrain.measurements.add('selectionMs', performance.now() - selectionStart);
      selection.current = selected;
      session.selectTarget(selected);
      marker.current!.visible = !!selected;
      if (selected) marker.current!.position.set(...selected.map(v => (v + 0.5) * CELL) as [number, number, number]);
      if (selected && (press || input.getSnapshot().mining)) session.hit(selected);
      current.cracks.sync(terrain.render.pipeline.residents);
      if (clock.status <= 0) {
        const info = terrain.snapshot();
        onStatus(terrain.error ?? (!terrain.ready(feet) ? '正在准备附近地形' : `深度 ${Math.max(0, Math.round(-feet[1] / CELL))} · 已挖 ${info.committedEdits}${selected ? ' · ' + mineralName(terrain.cell(selected) ?? 0) : ''}`));
        clock.status = 0.25;
      }
      terrain.measurements.add('frameCpuMs', performance.now() - start);
      terrain.measurements.add('frameIntervalMs', elapsed * 1000);
    } catch (reason) {
      error.current = `验证运行失败：${String(reason)}`; onStatus(error.current); throw reason;
    }
  });

  return <group ref={root}>
    <color attach="background" args={[GAME_CONFIG.background]} />
    <fog attach="fog" args={[GAME_CONFIG.background, 30, 54]} />
    <hemisphereLight args={['#e8f4ff', '#586252', 2.5]} />
    <directionalLight position={[5, 10, 7]} intensity={2.5} />
    <group ref={fixtures}>
      <mesh position={[SELL_ZONE.x, SELL_ZONE.y + 0.03, SELL_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SELL_ZONE.radius - 0.16, SELL_ZONE.radius, 48]} /><meshBasicMaterial color="#ffdc70" />
      </mesh>
      <mesh position={[SELL_ZONE.x, SELL_ZONE.y + 0.015, SELL_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[SELL_ZONE.radius - 0.16, 48]} /><meshBasicMaterial color="#ffc24d" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {BOXES.map((box, i) => <mesh key={i} position={box.center as [number, number, number]}><boxGeometry args={box.half.map(v => v * 2) as [number, number, number]} /><meshStandardMaterial color={box.color} roughness={1} /></mesh>)}
      <mesh><bufferGeometry onUpdate={g => g.computeVertexNormals()}><bufferAttribute attach="attributes-position" args={[RAMP.positions, 3]} /><bufferAttribute attach="index" args={[RAMP.indices, 1]} /></bufferGeometry><meshStandardMaterial color="#c7b692" roughness={1} /></mesh>
    </group>
    <group ref={avatar}>
      <mesh position={[0, GAME_CONFIG.player.height / 2, 0]}><cylinderGeometry args={[GAME_CONFIG.player.radius, GAME_CONFIG.player.radius, GAME_CONFIG.player.height, 20]} /><meshStandardMaterial color="#f0b45b" transparent /></mesh>
      <mesh position={[0, GAME_CONFIG.player.height + 0.005, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}><circleGeometry args={[0.23, 3]} /><meshBasicMaterial color="#253d45" transparent /></mesh>
    </group>
  </group>;
}

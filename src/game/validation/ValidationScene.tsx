import {SurfaceHubView} from '../presentation/SurfaceHubView.ts';
import {SURFACE_NIGHT} from '../world/SceneLighting.ts';
import { compileStableShadow } from '../presentation/stableShadow.ts';
import { ROOMS } from '../world/rooms.ts';
import { loadStaticSurface } from '../presentation/StaticSurface.ts';
import { disposeScenery } from '../presentation/SceneryMesh.ts';
import { RenderSubmission } from '../presentation/RenderSubmission.ts';
import { SurfaceEnvironment } from '../presentation/SurfaceEnvironment.ts';
import { ContactShadow } from '../presentation/ContactShadow.tsx';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Raycaster, Vector2, Mesh, Material, PerspectiveCamera, Color, Fog, HemisphereLight, DirectionalLight } from 'three';
import { GAME_CONFIG } from '../config.ts';
import type { GameInput } from '../GameInput.ts';
import { CharacterPhysics, initPhysics, BOXES, RAMP, PLAYER } from './physics.ts';
import { FixedStepClock, RenderSchedule, MOVEMENT } from '../movement.ts';
import { ThirdPersonCamera } from '../ThirdPersonCamera.ts';
import { COURSE_SPAWN } from './course.ts';
import { TerrainStream } from './TerrainStream.ts';
import { prepareSpawnTerrain } from './prepareSpawnTerrain.ts';
import { ORE_SAMPLES, mineralName } from '../terrain/minerals.ts';
import { selectCell } from '../terrain/selection.ts';
import { stratumAtDepth } from '../terrain/strata.ts';
import { CELL, WORLD_GENERATION, type Coord } from '../terrain/SparseWorld.ts';
import type { GameSession } from '../application/GameSession.ts';
import { RoomFacilities } from '../presentation/RoomFacilities.ts';
import {SceneLightingRig} from '../presentation/SceneLightingRig.ts';
import {createSelectionOutline} from '../presentation/SelectionOutline.ts';
import { BlockCracks } from '../presentation/BlockCracks.ts';
import { themeById } from '../content/themes.ts';
import { SELL_ZONE, SURFACE_RETURN } from '../application/items.ts';

export type ValidationDebug = {
  snapshot: () => unknown;
  surfaceHeight: (x:number,z:number)=>number|null;
  look: (yaw:number,pitch:number)=>void;
  canMine: (coord: Coord) => boolean;
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
  const params = new URLSearchParams(location.search), samples = params.get('debug') === '1' && params.get('samples') === '1';
  const surfaceBoxes = samples ? BOXES : [], ramp = samples ? RAMP : null;
  const root = useRef<Group>(null), avatar = useRef<Group>(null), fixtures = useRef<Group>(null);
  const runtime = useRef<{ physics: CharacterPhysics; terrain: TerrainStream; cracks: BlockCracks; facilities: RoomFacilities } | null>(null);
  const view = useRef({ yaw: Number(GAME_CONFIG.camera.initialYaw), pitch: Number(GAME_CONFIG.camera.initialPitch) });
  const followCamera = useRef(new ThirdPersonCamera());
  const shadowState=useRef({revision:-1,depth:NaN,updates:0});
  const contactShadow=useRef<Mesh>(null);
  const areaLighting=useRef<SceneLightingRig|null>(null);
  const surfaceEnvironment=useRef<SurfaceEnvironment|null>(null);
  const fixed = useRef(new FixedStepClock());
  const facing = useRef(0);
  const timing = useRef({ status: 0, frames: 0 });
  const startup = useRef({started:0,physicsMs:0,assetsReadyMs:0,terrainReadyMs:0,sceneAttachMs:0,terrainPendingAtAttach:-1,firstPlayableMs:0});
  const marker = useRef<ReturnType<typeof createSelectionOutline> | null>(null);
  const error = useRef<string | null>(null);
  const pickPoint = useRef(new Vector2());
  const pickRay = useRef(new Raycaster());
  const travelling = useRef<Coord | null>(null);
  const selection = useRef<Coord | null>(null);
  const { advance, gl, scene, camera: activeCamera } = useThree();
  const submission=useRef<RenderSubmission|null>(null);
  const sky=useRef(new Color(GAME_CONFIG.background)), themeColor=useRef(new Color()), ambient=useRef<HemisphereLight>(null), sun=useRef<DirectionalLight>(null);

  useEffect(() => {
    let cancelled = false;
    const controller=new AbortController();
    startup.current={started:performance.now(),physicsMs:0,assetsReadyMs:0,terrainReadyMs:0,sceneAttachMs:0,terrainPendingAtAttach:-1,firstPlayableMs:0};
    const previousFog=scene.fog, previousBackground=scene.background;
    gl.shadowMap.autoUpdate=false;
    surfaceEnvironment.current=new SurfaceEnvironment(gl,scene);
    areaLighting.current=new SceneLightingRig();root.current!.add(areaLighting.current.group);
    scene.fog=new Fog(GAME_CONFIG.background,38,74);
    let detach = () => {};
    let detachDamage = () => {};
    let detachHub=()=>{};
    let pendingSurface:Group|null=null;
    let pendingWorld:{physics:CharacterPhysics;terrain:TerrainStream}|null=null;
    const disposePending=()=>{
      if(pendingSurface){disposeScenery(pendingSurface);pendingSurface=null;}
      if(pendingWorld){pendingWorld.terrain.dispose();pendingWorld.physics.dispose();pendingWorld=null;}
    };
    let assetCount=0,terrainDone=false;
    onStatus('正在载入矿场场景');
    const preparedWorld=initPhysics().then(async()=>{
      controller.signal.throwIfAborted();
      startup.current.physicsMs=performance.now()-startup.current.started;
      const generation={...WORLD_GENERATION,samples};
      const physics=new CharacterPhysics(generation.samples),terrain=new TerrainStream(physics,undefined,session.collected,generation);
      const world={physics,terrain};pendingWorld=world;
      if(params.get('debug')==='1'&&params.has('layer')){
        const room=ROOMS.find(r=>r.id===params.get('layer'));if(!room)throw new Error('未知预览楼层');
        physics.teleport(room.spawn);
      }
      await prepareSpawnTerrain(terrain,physics.feet(),controller.signal,(done,total)=>{
        if(!cancelled)onStatus(`正在准备出生点地形 ${done}/${total}`);
      });
      terrainDone=true;startup.current.terrainReadyMs=performance.now()-startup.current.started;
      if(!cancelled)onStatus(assetCount<7?`正在载入矿场场景 ${assetCount}/7`:'正在准备画面');
      return world;
    });
    const preparedSurface=loadStaticSurface(gl,controller.signal,(done,total)=>{
      assetCount=done;if(!cancelled&&terrainDone)onStatus(`正在载入矿场场景 ${done}/${total}`);
    }).then(surface=>{
      if(cancelled||controller.signal.aborted){disposeScenery(surface);controller.signal.throwIfAborted();}
      pendingSurface=surface;startup.current.assetsReadyMs=performance.now()-startup.current.started;return surface;
    });
    Promise.all([preparedWorld,preparedSurface]).then(([{physics,terrain},surface])=>{
      if(cancelled){disposePending();return;}
      onStatus('正在准备画面');
      const teleport = (feet: readonly number[]) => {
        input.reset(); travelling.current = [...feet] as unknown as Coord; terrain.relocate(feet); fixed.current.reset(); session.resetPosition();
      };
      detach = session.attach({ cell: cell => terrain.cell(cell), canMine: cell => terrain.canMine(cell), pending: cell => terrain.pending(cell), mine: targets => terrain.mineMany(targets), cancelMining: () => terrain.cancelPending(), travelTo: teleport, returnToSurface: () => teleport(SURFACE_RETURN) });
      const cracks = new BlockCracks(); detachDamage = session.observeBlockDamage(cracks.setDamage); root.current!.add(cracks.group);
      const hub=new SurfaceHubView(surface);const updateHub=()=>hub.update(session.getSnapshot().destinations);updateHub();detachHub=session.subscribe(updateHub);
      const facilities = new RoomFacilities(physics,surface); root.current!.add(facilities.group);
      runtime.current = { physics, terrain, cracks, facilities }; root.current!.add(terrain.group);
      pendingWorld=null;pendingSurface=null;
      startup.current.sceneAttachMs=performance.now()-startup.current.started;
      startup.current.terrainPendingAtAttach=terrain.snapshot().queue;
      const outline=createSelectionOutline();
      outline.visible = false; marker.current = outline; root.current!.add(outline);
      if (new URLSearchParams(location.search).get('debug') === '1') {
        window.__miningValidation = {
          snapshot: () => ({ ...terrain.snapshot(), startup:{...startup.current,sky:surfaceEnvironment.current?.diagnostics()}, travelling: !!travelling.current, facilities: facilities.diagnostics(), lighting: {surfaceArea:areaLighting.current?.diagnostics(),cameraFar:(activeCamera as PerspectiveCamera).far,surfaceFog:!!scene.fog,staticShadowUpdates:shadowState.current.updates,shadowAutoUpdate:gl.shadowMap.autoUpdate,shadowMapSize:2048,shadowFilter:'stable-pcf5',surfaceReflections:surfaceEnvironment.current?.active??false}, cracks: cracks.diagnostics(), economy: session.getSnapshot(), combat: session.combatDebug(), sellZone: SELL_ZONE, samples: terrain.sampleStats(), terrainVisuals: terrain.render.diagnostics(), position: physics.feet(), grounded: physics.grounded, ready: !travelling.current && terrain.ready(physics.feet()), physicsSteps: physics.steps, jumps: physics.jumps, verticalSpeed: physics.verticalSpeed, droppedSeconds: fixed.current.droppedSeconds, renderedPosition: avatar.current?.position.toArray(), facing: avatar.current?.rotation.y, frames: timing.current.frames, renderer: { submission:submission.current?.snapshot(), calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }, view: { ...view.current }, camera: { ...followCamera.current.snapshot(), obstructed: followCamera.current.obstructed(physics.world, physics.collider) }, aim: { ...input.getAim() }, mineral: selection.current ? mineralName(terrain.cell(selection.current) ?? 0) : null, target: selection.current }),
          surfaceHeight:(x,z)=>facilities.surfaceHeight(x,z),
          look:(yaw,pitch)=>{view.current={yaw,pitch:Math.max(GAME_CONFIG.camera.minPitch,Math.min(GAME_CONFIG.camera.maxPitch,pitch))};},
          cell: coord => terrain.cell(coord), canMine: coord => terrain.canMine(coord),
          hit: session.hit, health: session.blockHealth,
          mine: coord => session.requestMine([coord]),
          mineMany: coords => session.requestMine(coords),
          wireframe: enabled => terrain.render.setWireframe(enabled),
          teleport: location => {
            const feet = location === 'surface' ? PLAYER.spawn : location === 'deep' ? ROOMS[ROOMS.length-1].spawn : location === 'course' ? COURSE_SPAWN : location === 'uniform' ? ORE_SAMPLES[0].spawn : location === 'bands' ? ORE_SAMPLES[1].spawn : location === 'checker' ? ORE_SAMPLES[2].spawn : location;
            if (feet.some(v => !Number.isFinite(v)) || feet[0] < -95 || feet[0] > 103 || feet[2] < -95 || feet[2] > 103 || feet[1] < -3999 || feet[1] > 20) throw new Error('验证位置超出矿区');
            teleport(feet);
          },
        };
      }
    }).catch(reason => { if(cancelled)return;controller.abort();disposePending();error.current = `初始化失败：${String(reason)}`; onStatus(error.current); });
    return () => {
      areaLighting.current?.dispose();areaLighting.current=null;
      surfaceEnvironment.current?.dispose();surfaceEnvironment.current=null;
      scene.fog=previousFog;scene.background=previousBackground;
      cancelled = true; controller.abort(); disposePending(); detachDamage();detachHub(); detach(); delete window.__miningValidation;
      const current = runtime.current; runtime.current = null;
      if (current) { current.facilities.group.removeFromParent(); current.facilities.dispose(); current.cracks.group.removeFromParent(); current.cracks.dispose(); current.terrain.group.removeFromParent(); current.terrain.dispose(); current.physics.dispose(); }
      if (marker.current) { marker.current.removeFromParent(); marker.current.geometry.dispose(); marker.current.material.dispose(); marker.current = null; }
    };
  }, [input, gl, scene, onStatus, session]);

  useEffect(()=>{
    const context=gl.getContext();
    if(!('fenceSync' in context))throw new Error('需要 WebGL2 绘制同步支持');
    const gate=new RenderSubmission(context);submission.current=gate;
    return ()=>{gate.dispose();if(submission.current===gate)submission.current=null;};
  },[gl]);

  // Priority 1 owns drawing; ordinary useFrame callbacks still simulate every
  // scheduled tick, including when the GPU has not completed its previous draw.
  useFrame(({gl,scene,camera})=>{
    try{submission.current?.draw(()=>gl.render(scene,camera));}
    catch(reason){error.current=`渲染失败：${String(reason)}`;onStatus(error.current);throw reason;}
  },1);

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
      const currentFeet = travelling.current ?? physics.feet();
      const sceneryStart=performance.now();
      if(!samples)current.facilities.sync(currentFeet);
      terrain.measurements.add('sceneResidencyMs',performance.now()-sceneryStart);
      const layer=stratumAtDepth(Math.max(0,-currentFeet[1]+.04)),theme=themeById(layer.theme);
      sky.current.lerp(themeColor.current.set(theme.sky),1-Math.exp(-delta*4));
      const meadow=theme.motif==='meadow';
      if(areaLighting.current?.setSurfaceActive(meadow))gl.shadowMap.needsUpdate=true;
      if(!meadow)scene.background=sky.current;
      surfaceEnvironment.current?.setEnabled(meadow);
      if(meadow)scene.fog=null;
      else {if(!(scene.fog instanceof Fog))scene.fog=new Fog(theme.sky,38,74);scene.fog.color.copy(sky.current);}
      if(ambient.current){ambient.current.groundColor.set(meadow?SURFACE_NIGHT.groundColor:theme.groundLight);ambient.current.color.set(meadow?SURFACE_NIGHT.skyColor:'#eef4ef');ambient.current.intensity=meadow?SURFACE_NIGHT.ambientIntensity:1.15;}
      if(sun.current && (shadowState.current.revision!==current.facilities.revision || shadowState.current.depth!==layer.from)){
        if(meadow)sun.current.position.set(...SURFACE_NIGHT.moonPosition);else sun.current.position.set(-24,42-layer.from,20);sun.current.target.position.set(0,-layer.from,0);sun.current.target.updateMatrixWorld();
        sun.current.color.set(meadow?SURFACE_NIGHT.moonColor:'#ffefd5');sun.current.intensity=meadow?SURFACE_NIGHT.moonIntensity:2.5;
        sun.current.shadow.bias=meadow?-.00055:-.0003;sun.current.shadow.normalBias=meadow?.095:.055;
        sun.current.shadow.intensity=meadow?.9:1;sun.current.shadow.radius=meadow?2.5:1;
        // Static prop shadows refresh on scene changes, not on every frame or mined cell.
        gl.shadowMap.needsUpdate=true;sun.current.shadow.needsUpdate=true;
        shadowState.current={revision:current.facilities.revision,depth:layer.from,updates:shadowState.current.updates+1};
      }
      physics.setSurfaceActive(currentFeet[1] > -48 && Math.abs(currentFeet[0]) < 64 && Math.abs(currentFeet[2] - 16) < 64);
      fixed.current.advance(elapsed, () => {
        const state = input.getSnapshot(); terrain.recenter(travelling.current ?? physics.feet());
        // Commit only immediately before a physics step: Rapier refreshes scene
        // queries in step(). Frames without a logic step defer resource installation.
        if (!processedTerrain) { terrain.process(); processedTerrain = true; }
        if (travelling.current) {
          if (!terrain.ready(travelling.current)) return;
          physics.teleport(travelling.current); travelling.current = null; followCamera.current.reset();
        }
        physics.tick(state.moveX, state.moveY, view.current.yaw, input.consumeJump(), terrain.ready(physics.feet()));
        session.updatePosition(physics.feet(), physics.grounded);
        if (state.moveX || state.moveY) facing.current = view.current.yaw + Math.atan2(-state.moveX, state.moveY);
      });
      if(!startup.current.firstPlayableMs&&!travelling.current&&terrain.ready(physics.feet())&&physics.grounded)startup.current.firstPlayableMs=performance.now()-startup.current.started;
      const feet = physics.feet(), drawnFeet = physics.interpolatedFeet(fixed.current.alpha);
      const turn = Math.atan2(Math.sin(facing.current - avatar.current.rotation.y), Math.cos(facing.current - avatar.current.rotation.y));
      avatar.current.rotation.y += turn * (1 - Math.exp(-MOVEMENT.turnSharpness * delta));
      avatar.current.position.set(...drawnFeet); fixtures.current!.visible = feet[1] > -64;
      if(contactShadow.current)contactShadow.current.visible=meadow&&physics.grounded;
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
          material.depthWrite = object!==contactShadow.current && rig.avatarOpacity >= 1;
        }
      });
      const selectionStart = performance.now(), press = input.consumeMinePress(), aim = press ?? input.getAim();
      let selected: Coord | null = null;
      if (aim.active && !travelling.current && terrain.ready(feet)) {
        // lookAt changes the local transform; picking must use this frame's camera.
        camera.updateMatrixWorld();
        pickRay.current.setFromCamera(pickPoint.current.set(aim.x, aim.y), lens);
        const { origin, direction } = pickRay.current.ray;
        selected = selectCell(origin.toArray(), direction.toArray(), [feet[0], feet[1] + 1, feet[2]],
          cell => terrain.cell(cell));
      }
      if (selected && !terrain.canMine(selected)) selected = null;
      terrain.measurements.add('selectionMs', performance.now() - selectionStart);
      selection.current = selected;
      session.selectTarget(selected);
      marker.current!.visible = !!selected;
      if (selected) marker.current!.position.set(...selected.map(v => (v + 0.5) * CELL) as [number, number, number]);
      if (selected && (press || input.getSnapshot().mining)) session.hit(selected);
      current.cracks.sync(terrain.render.pipeline.residents);
      if (clock.status <= 0) {
        const info = terrain.snapshot();
        onStatus(terrain.error ?? (travelling.current || !terrain.ready(feet) ? '正在准备附近地形' : `深度 ${Math.max(0, Math.round(-feet[1]))} 米 · ${stratumAtDepth(Math.max(0, Math.round(-feet[1]))).name} · 已挖 ${info.committedEdits}${selected ? ' · ' + mineralName(terrain.cell(selected) ?? 0) : ''}`));
        clock.status = 0.25;
      }
      terrain.measurements.add('frameCpuMs', performance.now() - start);
      terrain.measurements.add('frameIntervalMs', elapsed * 1000);
    } catch (reason) {
      error.current = `验证运行失败：${String(reason)}`; onStatus(error.current); throw reason;
    }
  });

  return <group ref={root}>
    <hemisphereLight ref={ambient} args={['#eef4ef', '#718574', 1.15]} />
    <directionalLight ref={sun} castShadow position={[-24,42,20]} color="#ffefd5" intensity={2.5}
 shadow-mapSize={[2048,2048]} shadow-camera-left={-42} shadow-camera-right={42} shadow-camera-top={42} shadow-camera-bottom={-42}
      shadow-camera-near={.5} shadow-camera-far={135} shadow-bias={-.0003} shadow-normalBias={.055} />
    <group ref={fixtures}>
      {surfaceBoxes.map((box, i) => <mesh receiveShadow key={i} position={box.center as [number, number, number]}><boxGeometry args={box.half.map(v => v * 2) as [number, number, number]} /><meshStandardMaterial color={box.color} roughness={1} /></mesh>)}
      {ramp && <mesh castShadow receiveShadow><bufferGeometry onUpdate={g => g.computeVertexNormals()}><bufferAttribute attach="attributes-position" args={[ramp.positions, 3]} /><bufferAttribute attach="index" args={[ramp.indices, 1]} /></bufferGeometry><meshStandardMaterial color="#dfd0ad" roughness={.85} flatShading onBeforeCompile={compileStableShadow} customProgramCacheKey={()=>'ramp-stable-pcf5-v1'} /></mesh>}
    </group>
    <group ref={avatar}>
      <ContactShadow shadowRef={contactShadow} />
      <mesh position={[0, GAME_CONFIG.player.height / 2, 0]}><cylinderGeometry args={[GAME_CONFIG.player.radius, GAME_CONFIG.player.radius, GAME_CONFIG.player.height, 20]} /><meshStandardMaterial color="#f0b45b" transparent /></mesh>
      <mesh position={[0, GAME_CONFIG.player.height + 0.005, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}><circleGeometry args={[0.23, 3]} /><meshBasicMaterial color="#253d45" transparent /></mesh>
    </group>
  </group>;
}

import { AdditiveBlending, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { WORLD_REQUIREMENTS, worldPortal, worldStation } from '../content/worldJourney.ts';
import { PINEWIND_GATE } from '../content/pinewind/hubLayout.ts';

/** The swirling portal disc in every world's teleport station ring (2.75 m up, 1.32 m across), and every world
 *  portal's sheet, violet and gold (world 1's fills its old ridge gate, the later worlds' a ring 2.9 m up). Where
 *  the player stands to open one, in every world: a round pad of glowing water under a faint column of light, cyan
 *  for the station and violet for the portal, so the two read the same everywhere, just above the ground (world
 *  2's portal: its dais floor) where the player stands. World 1's lie in rims Blender builds on the ground, the
 *  later worlds' stations on a plate flush with it. The frames themselves are scenery. */
const UP = new Vector3(0, 1, 0);
const STATION = ['#1fa8ec', '#aef4ff'] as const, PORTAL = ['#7a3fe0', '#f1d2ff'] as const;
export class TeleportStations {
  readonly group = new Group();
  private readonly time = { value: 0 };
  private readonly materials: ShaderMaterial[] = [];

  constructor() {
    this.group.name = 'teleport-stations';
    const swirl = this.material(`
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      // Two arms turning inward, a bright rim and a calm core.
      float arms = sin(a * 3.0 + r * 9.0 - uTime * 2.4) * .5 + .5;
      float glow = smoothstep(1.0, .55, r) * (.35 + .65 * arms) + smoothstep(.98, .86, r) * smoothstep(.7, .9, r) * .9;
      vec3 color = mix(vec3(.12, .55, .95), vec3(.55, 1.0, .95), arms * smoothstep(1.0, .2, r));
      gl_FragColor = vec4(color * glow, glow * smoothstep(1.02, .9, r));`);
    for (const world of WORLD_REQUIREMENTS) {
      const st = worldStation(world.id), station = new Group();
      station.position.set(st.x, 0, st.z); station.rotation.y = st.yaw;
      const disc = new Mesh(new CircleGeometry(1.34, 48), swirl); disc.position.y = 2.75; disc.renderOrder = 2;
      const at = new Vector3(st.zone.x - st.x, 0, st.zone.z - st.z).applyAxisAngle(UP, -st.yaw);
      station.add(disc, ...this.pad(at, st.zone.radius, ...STATION, .085));
      this.group.add(station);
    }
    const sheet = this.material(`
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float arms = sin(a * 4.0 + r * 7.0 - uTime * 1.8) * .5 + .5;
      float glow = smoothstep(1.0, .5, r) * (.4 + .6 * arms) + smoothstep(.99, .88, r) * smoothstep(.72, .9, r);
      vec3 color = mix(vec3(.55, .2, .95), vec3(1.0, .82, .4), arms * smoothstep(1.0, .15, r));
      gl_FragColor = vec4(color * glow, glow * smoothstep(1.02, .92, r));`);
    for (const world of WORLD_REQUIREMENTS) {
      const pt = worldPortal(world.id), portal = new Group();
      portal.position.set(pt.x, pt.y, pt.z); portal.rotation.y = pt.yaw;
      const g = PINEWIND_GATE, face = world.id === 1
        ? new Mesh(new PlaneGeometry(g.opening - .3, g.height - 1.9), sheet) : new Mesh(new CircleGeometry(1.85, 48), sheet);
      face.position.y = world.id === 1 ? (g.height - 1.9) / 2 + .05 : 2.9; face.renderOrder = 2;
      const at = new Vector3(pt.zone.x - pt.x, 0, pt.zone.z - pt.z).applyAxisAngle(UP, -pt.yaw);
      portal.add(face, ...this.pad(at, pt.zone.radius, ...PORTAL, .085));
      this.group.add(portal);
    }
  }

  update(delta: number) { this.time.value = (this.time.value + delta) % 4096; }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
    for (const m of this.materials) m.dispose();
  }

  /** A pad's glowing water (opaque, so it reads on the pale sand: rings drifting outward over a slow swirl,
   *  brightest at the rim) and the column of light rising from it, fading upward. */
  private pad(at: Vector3, radius: number, deep: string, bright: string, y: number) {
    const colors = { uDeep: { value: new Color(deep) }, uBright: { value: new Color(bright) } };
    const water = new ShaderMaterial({
      uniforms: { uTime: this.time, ...colors },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uBright; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p);
          float wave = sin(r * 13.0 - uTime * 2.6) * .5 + .5;
          float swirl = sin(atan(p.y, p.x) * 3.0 + r * 5.0 - uTime * 1.3) * .5 + .5;
          float light = clamp(.25 + .45 * wave * (.55 + .45 * swirl) + .55 * smoothstep(.72, 1.0, r), 0.0, 1.0);
          gl_FragColor = vec4(mix(uDeep, uBright, light), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.materials.push(water);
    const pool = new Mesh(new CircleGeometry(radius - .26, 48).rotateX(-Math.PI / 2), water);
    pool.position.set(at.x, y, at.z);
    const beam = new ShaderMaterial({
      uniforms: { uTime: this.time, ...colors }, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uBright; varying vec2 vUv;
        void main(){
          float fade = pow(1.0 - vUv.y, 2.4);
          float streak = .65 + .35 * sin(vUv.x * 37.7 + uTime * 1.1) * sin(vUv.y * 8.0 - uTime * 2.2);
          gl_FragColor = vec4(uBright, fade * streak * .42);
        }`,
    });
    this.materials.push(beam);
    const column = new Mesh(new CylinderGeometry(radius - .32, radius - .32, 2.6, 40, 1, true), beam);
    column.position.set(at.x, y + 1.3, at.z); column.renderOrder = 3;
    return [pool, column];
  }

  private material(body: string) {
    const material = new ShaderMaterial({
      uniforms: { uTime: this.time }, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ ${body} }`,
    });
    this.materials.push(material);
    return material;
  }
}

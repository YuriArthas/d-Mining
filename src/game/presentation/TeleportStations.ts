import { AdditiveBlending, CircleGeometry, DoubleSide, Group, Mesh, PlaneGeometry, RingGeometry, ShaderMaterial, Vector3 } from 'three';
import { WORLD_REQUIREMENTS, worldPortal, worldStation } from '../content/worldJourney.ts';
import { PINEWIND_GATE } from '../content/pinewind/hubLayout.ts';

/** The swirling portal disc in every world's teleport station ring (2.75 m up, 1.32 m across), and a soft
 *  glowing ring on its pad; and every world portal's sheet, violet and gold (world 1's fills its old ridge gate,
 *  the later worlds' a ring 2.9 m up). The frames themselves are scenery. */
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
    const pad = this.material(`
      // RingGeometry UVs are planar: distance from the ring's middle radius (0.57 of the half-size).
      float d = length(vUv * 2.0 - 1.0), r = clamp(abs(d - .85) / .15, 0.0, 1.0);
      float pulse = .55 + .45 * sin(uTime * 2.0);
      gl_FragColor = vec4(vec3(.35, .9, 1.0) * (1.0 - r) * pulse, (1.0 - r) * pulse);`);
    for (const world of WORLD_REQUIREMENTS) {
      const st = worldStation(world.id), station = new Group();
      station.position.set(st.x, 0, st.z); station.rotation.y = st.yaw;
      const disc = new Mesh(new CircleGeometry(1.34, 48), swirl); disc.position.y = 2.75; disc.renderOrder = 2;
      const ring = new Mesh(new RingGeometry(.95, 1.35, 48, 1).rotateX(-Math.PI / 2), pad);
      ring.position.copy(new Vector3(st.zone.x - st.x, .48, st.zone.z - st.z).applyAxisAngle(new Vector3(0, 1, 0), -st.yaw));
      station.add(disc, ring); this.group.add(station);
    }
    const sheet = this.material(`
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float arms = sin(a * 4.0 + r * 7.0 - uTime * 1.8) * .5 + .5;
      float glow = smoothstep(1.0, .5, r) * (.4 + .6 * arms) + smoothstep(.99, .88, r) * smoothstep(.72, .9, r);
      vec3 color = mix(vec3(.55, .2, .95), vec3(1.0, .82, .4), arms * smoothstep(1.0, .15, r));
      gl_FragColor = vec4(color * glow, glow * smoothstep(1.02, .92, r));`);
    const portalPad = this.material(`
      float d = length(vUv * 2.0 - 1.0), r = clamp(abs(d - .85) / .15, 0.0, 1.0);
      float pulse = .55 + .45 * sin(uTime * 1.6);
      gl_FragColor = vec4(vec3(.85, .55, 1.0) * (1.0 - r) * pulse, (1.0 - r) * pulse);`);
    for (const world of WORLD_REQUIREMENTS) {
      const pt = worldPortal(world.id), portal = new Group();
      portal.position.set(pt.x, 0, pt.z); portal.rotation.y = pt.yaw;
      const g = PINEWIND_GATE, face = world.id === 1
        ? new Mesh(new PlaneGeometry(g.opening - .3, g.height - 1.9), sheet) : new Mesh(new CircleGeometry(1.85, 48), sheet);
      face.position.y = world.id === 1 ? (g.height - 1.9) / 2 + .05 : 2.9; face.renderOrder = 2;
      const ring = new Mesh(new RingGeometry(world.id === 1 ? 1.6 : 1.3, world.id === 1 ? 2.2 : 1.8, 48, 1).rotateX(-Math.PI / 2), portalPad);
      ring.position.copy(new Vector3(pt.zone.x - pt.x, .06, pt.zone.z - pt.z).applyAxisAngle(new Vector3(0, 1, 0), -pt.yaw));
      portal.add(face, ring); this.group.add(portal);
    }
  }

  update(delta: number) { this.time.value = (this.time.value + delta) % 4096; }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
    for (const m of this.materials) m.dispose();
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

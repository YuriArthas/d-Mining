import type { Object3D } from 'three';

type Spin = { node: Object3D; axis: 'x' | 'y' | 'z'; rate: number };
type Slide = { node: Object3D; axis: 'x' | 'y' | 'z'; length: number; rate: number; starts: number[] };

/** Moving parts in the authored scenes, found by node name (the offline builds keep them out of the static
 *  batches): `Spin_<axis>_<centi-radians per second>` turns about its own axis (turbine rotors, drill bits,
 *  fans); `Slide_<axis>_<length cm>_<cm per second>` moves its children along the axis and wraps them back
 *  over the length (conveyor cleats and the ore on them). Rates may be negative (`n` prefix, e.g. Spin_y_n150). */
export class SceneMotion {
  private readonly spins: Spin[] = [];
  private readonly slides: Slide[] = [];
  private time = 0;
  constructor(root: Object3D) {
    const value = (text: string) => (text.startsWith('n') ? -1 : 1) * Number(text.replace(/^n/, '')) / 100;
    root.traverse(node => {
      const spin = /^Spin_([xyz])_(n?\d+)/.exec(node.name);
      if (spin) this.spins.push({ node, axis: spin[1] as Spin['axis'], rate: value(spin[2]) });
      const slide = /^Slide_([xyz])_(\d+)_(n?\d+)/.exec(node.name);
      if (slide) this.slides.push({ node, axis: slide[1] as Slide['axis'], length: value(slide[2]), rate: value(slide[3]), starts: node.children.map(c => c.position[slide[1] as Slide['axis']]) });
    });
  }
  get parts() { return this.spins.length + this.slides.length; }
  update(delta: number) {
    this.time += delta;
    for (const s of this.spins) s.node.rotation[s.axis] += s.rate * delta;
    for (const s of this.slides) s.node.children.forEach((child, i) => {
      const t = (((s.starts[i] + s.rate * this.time) % s.length) + s.length) % s.length;
      child.position[s.axis] = t;
    });
  }
}

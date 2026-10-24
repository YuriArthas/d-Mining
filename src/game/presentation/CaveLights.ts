import { Group, PointLight } from 'three';
import { HALL_BY_LAYER, undergroundHall } from '../content/underground/halls.ts';

type Room = Readonly<{ id: string; x: number; z: number; depth: number }>;
const POOL = 6;

/** Underground light: a fixed pool of point lights moved to the current layer's hall sources (glowing
 *  mushrooms, stall lanterns), and a warm helmet lamp so freshly dug tunnels never go black. The number of
 *  lights never changes (no shader recompiles when changing layers); unused ones sit at zero. No shadows. */
export class CaveLights {
  readonly group = new Group();
  private readonly pool: PointLight[] = [];
  private readonly helmet = new PointLight('#fff1df', 0, 11, 2);
  private readonly rooms: readonly Room[];
  private hall: string | null = null;

  constructor(rooms: readonly Room[]) {
    this.rooms = rooms;
    this.group.name = 'cave-lights';
    for (let i = 0; i < POOL; i++) { const light = new PointLight('#ffffff', 0, 10, 2); light.castShadow = false; this.pool.push(light); this.group.add(light); }
    this.helmet.castShadow = false; this.group.add(this.helmet);
  }

  /** Call every frame with the drawn feet, the layer at them and how much surface daylight reaches them (0-1). */
  update(feet: readonly number[], layerId: string, surfaceLight: number) {
    const underground = 1 - Math.max(0, Math.min(1, surfaceLight));
    this.helmet.position.set(feet[0], feet[1] + 2.3, feet[2]);
    this.helmet.intensity = 4.5 * underground;
    const hallId = HALL_BY_LAYER[layerId] ?? null;
    if (hallId === this.hall) return;
    this.hall = hallId;
    const room = hallId ? this.rooms.find(r => r.id === layerId) : undefined;
    const lights = hallId && room ? undergroundHall(hallId).hall.lights : [];
    this.pool.forEach((light, i) => {
      const source = lights[i];
      if (!source || !room) { light.intensity = 0; return; }
      light.position.set(room.x + source.at[0], -room.depth + source.at[1], room.z + source.at[2]);
      light.color.set(source.color); light.intensity = source.intensity; light.distance = source.distance;
    });
  }

  diagnostics() { return { hall: this.hall, lights: this.pool.filter(l => l.intensity > 0).length, helmet: this.helmet.intensity }; }

  dispose() { for (const light of [...this.pool, this.helmet]) light.dispose(); this.group.removeFromParent(); }
}

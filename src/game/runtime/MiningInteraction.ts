import { Group, Raycaster, Vector2, type PerspectiveCamera } from "three";
import { MiningLessonHighlight } from '../presentation/MiningLessonHighlight.ts';
import { createSelectionOutline } from "../presentation/SelectionOutline.ts";
import { BlockCracks } from "../presentation/BlockCracks.ts";
import { selectCell } from "../terrain/selection.ts";
import { CELL, type Coord } from "../terrain/SparseWorld.ts";
import type { GameSession } from "../application/GameSession.ts";
import type { GameInput } from "../GameInput.ts";
import type { TerrainStream } from "../validation/TerrainStream.ts";

export class MiningInteraction {
  readonly group = new Group();
  readonly lesson = new MiningLessonHighlight();
  readonly cracks = new BlockCracks();
  readonly marker = createSelectionOutline();
  selected: Coord | null = null;
  /** The accepted hit of this frame: where the pick swings, the block kind it hit, and whether it broke. */
  strike: { target: Coord; speed: number; cell: Coord; kind: number; damage: number; breaking: boolean } | null = null;
  private readonly point = new Vector2();
  private readonly ray = new Raycaster();
  private readonly session: GameSession;
  private readonly detach: () => void;
  private disposed = false;
  constructor(session: GameSession) {
    this.session = session;
    this.marker.visible = false;
    this.group.add(this.cracks.group, this.marker, this.lesson.group);
    this.detach = session.observeBlockDamage(this.cracks.setDamage);
  }
  update(
    camera: PerspectiveCamera,
    feet: readonly number[],
    travelling: boolean,
    input: GameInput,
    terrain: TerrainStream,
  ) {
    this.strike=null;
    const start = terrain.measurements.enabled ? performance.now() : 0,
      press = input.consumeMinePress(),
      aim = press ?? input.getAim();
    let selected: Coord | null = null;
    if (aim.active && !travelling && terrain.ready(feet)) {
      camera.updateMatrixWorld();
      this.ray.setFromCamera(this.point.set(aim.x, aim.y), camera);
      const { origin, direction } = this.ray.ray;
      selected = selectCell(
        origin.toArray(),
        direction.toArray(),
        [feet[0], feet[1] + 1, feet[2]],
        (cell) => terrain.cell(cell),
      );
    }
    if (selected && !terrain.canMine(selected)) selected = null;
    if (terrain.measurements.enabled) terrain.measurements.add("selectionMs", performance.now() - start);
    this.selected = selected;
    this.session.selectTarget(selected);
    this.marker.visible = !!selected;
    if (selected)
      this.marker.position.set(
        ...(selected.map((v) => (v + 0.5) * CELL) as [number, number, number]),
      );
    if (selected && (press || input.getSnapshot().mining)) {
      const kind=terrain.cell(selected)??0, result=this.session.hit(selected);
      if((result.status==='hit'||result.status==='breaking')&&result.damage>0)
        this.strike={target:selected.map(v=>(v+.5)*CELL) as unknown as Coord,speed:this.session.getSnapshot().miningStats.speed,cell:selected,kind,damage:result.damage,breaking:result.status==='breaking'};
    }
    this.cracks.sync(terrain.render.pipeline.residents);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    this.cracks.dispose();
    this.lesson.dispose();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}

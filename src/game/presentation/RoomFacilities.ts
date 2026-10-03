import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, RingGeometry, Sprite, SpriteMaterial } from 'three';
import { ENTRANCE_EDGES } from '../world/entrance.ts';
import { ROOMS, type RestRoom } from '../world/rooms.ts';

// Signs and rings are visual fixtures. The protected floor uses the existing
// independently streamed voxel render/collision pipelines, with no overlay collider.
export class RoomFacilities {
  readonly group = new Group();
  private visuals = new Map<string, Group>();
  private distance(room: RestRoom, feet: readonly number[]) {
    return Math.max(Math.abs(feet[0] - room.x) - 20, Math.abs(feet[1] + room.depth), Math.abs(feet[2] - room.z) - 20, 0);
  }
  private create(room: RestRoom) {
    const group = new Group();
    for (const edge of ENTRANCE_EDGES) {
      const mesh = new Mesh(new BoxGeometry(...edge.size), new MeshBasicMaterial({ color: '#f3d782' }));
      mesh.position.set(edge.center[0], edge.center[1] - room.depth, edge.center[2]); group.add(mesh);
    }
    for (const [zone, text, color] of [[room.sell, '出售矿物', '#ffdc70'], [room.shop, '升级商店', '#85dfdb']] as const) {
      if (!zone) continue;
      const ring = new Mesh(new RingGeometry(zone.radius - 0.16, zone.radius, 32), new MeshBasicMaterial({ color }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(zone.x, zone.y + 0.03, zone.z); group.add(ring);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#142c31'; ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(text, 256, 56);
      ctx.font = '28px sans-serif'; ctx.fillText(`${room.name} · ${room.depth} 米`, 256, 102);
      const label = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas) }));
      label.position.set(zone.x, zone.y + 3.3, zone.z - 1); label.scale.set(5, 1.25, 1); group.add(label);
    }
    this.visuals.set(room.id, group); this.group.add(group);
  }
  private removeVisual(id: string) {
    const group = this.visuals.get(id); if (!group) return;
    group.traverse(object => {
      if (object instanceof Mesh || object instanceof Sprite) {
        if (object instanceof Mesh) object.geometry.dispose();
        const material = object.material as MeshBasicMaterial | SpriteMaterial;
        material.map?.dispose(); material.dispose();
      }
    });
    group.removeFromParent(); this.visuals.delete(id);
  }
  sync(feet: readonly number[]) {
    for (const room of ROOMS) {
      const distance = this.distance(room, feet);
      if (distance <= 54 && !this.visuals.has(room.id)) this.create(room);
      if (distance > 78) this.removeVisual(room.id);

    }
  }
  diagnostics() { return { visuals: [...this.visuals.keys()] }; }
  dispose() {
    for (const id of this.visuals.keys()) this.removeVisual(id);
  }
}

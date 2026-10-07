import { integer } from '../numbers.ts';
import { petId, petRecord, type EquipResult, type PetEquipmentSnapshot, type PetEquipmentDataV1 } from './types.ts';

export class PetEquipment {
  private snapshot: PetEquipmentSnapshot;
  constructor(slotCount: number) {
    if (!integer(slotCount, '宠物槽位')) throw Error('宠物槽位必须大于 0');
    this.snapshot = Object.freeze({ slots: Object.freeze(Array<string | null>(slotCount).fill(null)) });
  }
  getSnapshot = (): PetEquipmentSnapshot => this.snapshot;
  equip(id: string): EquipResult {
    petId(id);
    const slots = this.snapshot.slots, existing = slots.indexOf(id);
    if (existing >= 0) return { status: 'already-equipped', slot: existing };
    const slot = slots.indexOf(null);
    if (slot < 0) return { status: 'full' };
    const next = [...slots]; next[slot] = id; this.replace(next);
    return { status: 'equipped', slot };
  }
  unequip(id: string): boolean { return this.replace(this.snapshot.slots.map(value => value === id ? null : value)); }
  clear(): boolean { return this.replace(this.snapshot.slots.map(() => null)); }
  replace(slots: readonly (string | null)[]): boolean {
    if (slots.length !== this.snapshot.slots.length) throw Error('宠物装备槽数不匹配');
    const seen = new Set<string>();
    // Array.from also checks holes instead of accidentally treating them as empty slots.
    for (const id of Array.from(slots)) if (id !== null) {
      petId(id);
      if (seen.has(id)) throw Error(`宠物重复装备: ${id}`);
      seen.add(id);
    }
    if (slots.every((id, i) => id === this.snapshot.slots[i])) return false;
    this.snapshot = Object.freeze({ slots: Object.freeze([...slots]) });
    return true;
  }
  exportData(): PetEquipmentDataV1 { return { version: 1, slots: [...this.snapshot.slots] }; }
  static fromData(value: unknown, slotCount: number): PetEquipment {
    const data = petRecord(value);
    if (data.version !== 1 || !Array.isArray(data.slots)) throw Error('无效宠物装备版本或数据');
    const equipment = new PetEquipment(slotCount);
    equipment.replace(data.slots);
    return equipment;
  }
}

import { versionOne } from './data.ts';
import { integer } from './numbers.ts';
export type EquipmentData = {version:1;toolLevel:number;backpackCapacity:number};
/** Highest sequential purchase; active equipment remains in Pickaxe/Inventory. */
export class EquipmentCollection {
  toolLevel: number;
  backpackCapacity: number;
  constructor(activeTool:number,activeCapacity:number,data?:unknown) {
    // Saves before equipment selection only contained the highest bought item.
    const saved=data===undefined?null:versionOne(data);
    this.toolLevel=saved?integer(saved.toolLevel as number,'已购工具'):activeTool;
    this.backpackCapacity=saved?integer(saved.backpackCapacity as number,'已购容量'):activeCapacity;
    if(this.toolLevel<activeTool||this.backpackCapacity<activeCapacity||this.toolLevel<1||this.backpackCapacity<1)throw Error('装备收藏与已装备物品不一致');
  }
  exportData():EquipmentData{return {version:1,toolLevel:this.toolLevel,backpackCapacity:this.backpackCapacity};}
}

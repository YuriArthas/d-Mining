import { versionOne } from './data.ts';
import { integer } from './numbers.ts';
import { ECONOMY } from '../content/economy.ts';
export type EquipmentData = {version:1;toolLevel:number;backpackCapacity:number;enhance:number;tools?:number[];backpacks?:number[]};
/** Explicit purchases; highest bought gear still controls progression and enhancements. */
export class EquipmentCollection {
  toolLevel: number;
  backpackCapacity: number;
  enhance: number;
  private tools: Set<number>;
  private backpacks: Set<number>;
  constructor(activeTool:number,activeCapacity:number,data?:unknown) {
    const saved=data===undefined?null:versionOne(data);
    this.toolLevel=saved?integer(saved.toolLevel as number,'已购工具'):activeTool;
    this.backpackCapacity=saved?integer(saved.backpackCapacity as number,'已购容量'):activeCapacity;
    this.enhance=saved?integer((saved.enhance??0) as number,'强化等级'):0;
    if(this.enhance>3)throw Error('强化等级无效');
    if(this.toolLevel<1||this.backpackCapacity<1)throw Error('装备收藏与已装备物品不一致');
    const read=(value:unknown,allowed:number[],highest:number)=>{
      // Old saves were sequential: retain their already-owned lower tiers.
      const list=value===undefined?allowed.filter(n=>n<=highest):value;
      if(!Array.isArray(list)||list.some(n=>!allowed.includes(n)||n>highest)||!list.includes(highest))throw Error('装备购买记录无效');
      return new Set<number>(list);
    };
    this.tools=read(saved?.tools,ECONOMY.tools.map(t=>t.level),this.toolLevel);
    this.backpacks=read(saved?.backpacks,[...ECONOMY.bags.map(b=>b.capacity),activeCapacity,this.backpackCapacity],this.backpackCapacity);
    if(!this.ownsTool(activeTool)||!this.ownsBackpack(activeCapacity))throw Error('装备收藏与已装备物品不一致');
  }
  ownsTool(level:number){return this.tools.has(level);}
  ownsBackpack(capacity:number){return this.backpacks.has(capacity);}
  buyTool(level:number){this.tools.add(level);if(level>this.toolLevel){this.toolLevel=level;this.enhance=0;}}
  buyBackpack(capacity:number){this.backpacks.add(capacity);this.backpackCapacity=Math.max(this.backpackCapacity,capacity);}
  reset(tool:number,capacity:number){this.toolLevel=tool;this.backpackCapacity=capacity;this.enhance=0;this.tools=new Set([tool]);this.backpacks=new Set([capacity]);}
  exportData():EquipmentData{return {version:1,toolLevel:this.toolLevel,backpackCapacity:this.backpackCapacity,enhance:this.enhance,
    ...(this.tools.size!==this.toolLevel&&{tools:[...this.tools].sort((a,b)=>a-b)}),
    ...(this.backpacks.size!==ECONOMY.bags.filter(b=>b.capacity<=this.backpackCapacity).length&&{backpacks:[...this.backpacks].sort((a,b)=>a-b)})};}
}

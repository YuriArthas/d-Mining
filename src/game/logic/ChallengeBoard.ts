export type ChallengeMiner = Readonly<{ id: string; name: string; depth: number }>;
export type ChallengeBoardData = Readonly<{ version: 1; miners: readonly ChallengeMiner[] }>;
const NAMES = ['铁锹阿林', '石头队长', '铜矿小鹿', '深井阿布', '水晶松鼠', '背包小熊', '地心探险家'];
export class ChallengeBoard {
  private readonly data: ChallengeBoardData;
  constructor(random: () => number = Math.random, saved?: unknown) {
    if (saved !== undefined) {
      if (!saved || typeof saved !== 'object') throw Error('挑战榜存档错误');
      const d = saved as ChallengeBoardData;
      if (d.version !== 1 || !Array.isArray(d.miners) || d.miners.length !== NAMES.length) throw Error('挑战榜版本或人数错误');
      const ids = new Set<string>();
      this.data = Object.freeze({version:1, miners:Object.freeze(d.miners.map(m => {
        if (!m || typeof m.id !== 'string' || !m.id || m.id === 'self' || ids.has(m.id) || typeof m.name !== 'string' || !m.name || m.name.length > 24 || !Number.isInteger(m.depth) || m.depth < 0 || m.depth > 4000) throw Error('挑战榜矿工数据错误');
        ids.add(m.id); return Object.freeze({id:m.id,name:m.name,depth:m.depth});
      }))});
    } else this.data = Object.freeze({version:1, miners:Object.freeze(NAMES.map((name, i) => {
      const roll = random();
      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw Error('挑战榜随机值必须在 [0, 1)');
      return Object.freeze({id:`miner-${i}`, name, depth:Math.floor(40 + i * 430 + roll * 360)});
    }))});
  }
  exportData() { return this.data; }
  rows(maxDepth: number) {
    return [...this.data.miners, {id:'self',name:'你',depth:Math.floor(maxDepth)}]
      .sort((a,b) => b.depth-a.depth || (a.id==='self'?-1:b.id==='self'?1:a.id.localeCompare(b.id)));
  }
}

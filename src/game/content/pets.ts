import type { PetContent, PetDefinition, EggDefinition, PetRarity } from '../logic/pets/types.ts';

// Each offer owns its explicit price and rewards. Display row/height has no gameplay meaning.
// Tuple: species ID, name, rarity, power bonus in basis points, draw weight.
type Reward = readonly [string, string, PetRarity, number, number];
function egg(id: string, name: string, price: number, rewards: readonly Reward[]) {
  const pets: PetDefinition[] = rewards.map(([id, name, rarity, powerBonusBps]) => ({ id, name, rarity, powerBonusBps }));
  const offer: EggDefinition = { id, name, price, outcomes: rewards.map(([speciesId, , , , weight]) => ({ speciesId, weight })) };
  return { pets, offer };
}
const offers = [
  egg('meadow-egg', '原野蛋', 10, [
    ['moss-slime', '苔团', 'common', 1000, 40],
    ['quarry-mole', '矿洞鼹鼠', 'common', 1500, 30],
    ['amber-fox', '琥珀狐', 'rare', 2500, 20],
    ['crystal-owl', '晶羽猫头鹰', 'epic', 4000, 8],
    ['moon-dragon', '月光幼龙', 'legendary', 7500, 2],
  ]),
  egg('pebble-egg', '卵石蛋', 35, [
    ['pebble-blob', '石团', 'common', 1600, 42],
    ['pebble-scout', '砂鼠', 'common', 2300, 28],
    ['pebble-friend', '斑岩兔', 'rare', 3600, 20],
    ['pebble-wing', '青石龟', 'epic', 6000, 8],
    ['pebble-guardian', '磐岩熊', 'legendary', 10000, 2],
  ]),
  egg('copper-egg', '铜矿蛋', 95, [
    ['copper-blob', '铜团', 'common', 2500, 38],
    ['copper-scout', '铜尾鼠', 'common', 3500, 32],
    ['copper-friend', '赤铜狐', 'rare', 5500, 20],
    ['copper-wing', '黄铜鸟', 'epic', 8500, 8],
    ['copper-guardian', '铜角牛', 'legendary', 14000, 2],
  ]),
  egg('amber-egg', '琥珀蛋', 180, [
    ['amber-blob', '蜜团', 'common', 3400, 45],
    ['amber-scout', '琥珀蜂', 'common', 4800, 25],
    ['amber-friend', '蜜蜡兔', 'rare', 7500, 19],
    ['amber-wing', '金翅蝶', 'epic', 11500, 9],
    ['amber-guardian', '琥珀狮', 'legendary', 18500, 2],
  ]),
  egg('tide-egg', '潮汐蛋', 280, [
    ['tide-blob', '水团', 'common', 4000, 40],
    ['tide-scout', '泡泡鱼', 'common', 6000, 30],
    ['tide-friend', '珊瑚蟹', 'rare', 9500, 18],
    ['tide-wing', '浪花鲸', 'epic', 14500, 10],
    ['tide-guardian', '潮汐龙', 'legendary', 24000, 2],
  ]),
  egg('fire-egg', '火花蛋', 450, [
    ['fire-blob', '火团', 'common', 5000, 44],
    ['fire-scout', '炭球鼠', 'common', 7500, 28],
    ['fire-friend', '火尾狐', 'rare', 11500, 18],
    ['fire-wing', '赤焰鸟', 'epic', 18000, 8],
    ['fire-guardian', '火花龙', 'legendary', 29000, 2],
  ]),
  egg('mushroom-egg', '蘑菇蛋', 120, [
    ['mushroom-blob', '菇团', 'common', 2800, 40],
    ['mushroom-scout', '伞菇鼠', 'common', 4000, 33],
    ['mushroom-friend', '绒菇兔', 'rare', 6200, 18],
    ['mushroom-wing', '荧光蛙', 'epic', 10000, 7],
    ['mushroom-guardian', '蘑菇鹿', 'legendary', 16000, 2],
  ]),
  egg('silver-egg', '白银蛋', 600, [
    ['silver-blob', '银团', 'common', 6000, 40],
    ['silver-scout', '银尾鼠', 'common', 8500, 30],
    ['silver-friend', '银耳兔', 'rare', 13500, 20],
    ['silver-wing', '银羽鹰', 'epic', 21000, 8],
    ['silver-guardian', '银角鹿', 'legendary', 34000, 2],
  ]),
  egg('crystal-egg', '水晶蛋', 900, [
    ['crystal-blob', '晶团', 'common', 7500, 43],
    ['crystal-scout', '晶壳虫', 'common', 11000, 29],
    ['crystal-friend', '紫晶狐', 'rare', 16500, 18],
    ['crystal-wing', '晶羽鹤', 'epic', 25500, 8],
    ['crystal-guardian', '水晶龙', 'legendary', 41000, 2],
  ]),
  egg('frost-egg', '冰霜蛋', 1700, [
    ['frost-blob', '雪团', 'common', 10000, 40],
    ['frost-scout', '冰尾鼠', 'common', 14500, 30],
    ['frost-friend', '雪绒兔', 'rare', 22000, 20],
    ['frost-wing', '冰羽鹰', 'epic', 34500, 8],
    ['frost-guardian', '霜角熊', 'legendary', 55000, 2],
  ]),
  egg('jade-egg', '翡翠蛋', 2400, [
    ['jade-blob', '翠团', 'common', 12500, 46],
    ['jade-scout', '玉壳虫', 'common', 18000, 26],
    ['jade-friend', '翠尾狐', 'rare', 28000, 18],
    ['jade-wing', '碧羽雀', 'epic', 43000, 8],
    ['jade-guardian', '翡翠鹿', 'legendary', 68000, 2],
  ]),
  egg('moon-egg', '月光蛋', 3600, [
    ['moon-blob', '月团', 'common', 15000, 40],
    ['moon-scout', '月耳兔', 'common', 22500, 31],
    ['moon-friend', '月影猫', 'rare', 34000, 19],
    ['moon-wing', '月羽枭', 'epic', 52000, 8],
    ['moon-guardian', '月冠龙', 'legendary', 85000, 2],
  ]),
  egg('ruin-egg', '遗迹蛋', 2100, [
    ['ruin-blob', '砂团', 'common', 11500, 42],
    ['ruin-scout', '石纹鼠', 'common', 17000, 30],
    ['ruin-friend', '古印猫', 'rare', 25500, 18],
    ['ruin-wing', '符文鹰', 'epic', 40000, 8],
    ['ruin-guardian', '遗迹兽', 'legendary', 65000, 2],
  ]),
  egg('lava-egg', '熔岩蛋', 4800, [
    ['lava-blob', '熔团', 'common', 18000, 40],
    ['lava-scout', '熔壳虫', 'common', 26500, 30],
    ['lava-friend', '岩浆蜥', 'rare', 40000, 19],
    ['lava-wing', '熔翼蝠', 'epic', 62000, 9],
    ['lava-guardian', '熔岩龙', 'legendary', 100000, 2],
  ]),
  egg('fossil-egg', '化石蛋', 6500, [
    ['fossil-blob', '骨团', 'common', 21000, 43],
    ['fossil-scout', '骨尾鼠', 'common', 31000, 29],
    ['fossil-friend', '化石龟', 'rare', 47000, 18],
    ['fossil-wing', '骨翼鸟', 'epic', 73000, 8],
    ['fossil-guardian', '远古龙', 'legendary', 115000, 2],
  ]),
  egg('gear-egg', '齿轮蛋', 9500, [
    ['gear-blob', '铁团', 'common', 25000, 40],
    ['gear-scout', '发条鼠', 'common', 36500, 32],
    ['gear-friend', '齿轮猫', 'rare', 56000, 18],
    ['gear-wing', '机械鹰', 'epic', 85000, 8],
    ['gear-guardian', '钢铁熊', 'legendary', 135000, 2],
  ]),
  egg('star-egg', '星辉蛋', 14500, [
    ['star-blob', '星团', 'common', 29000, 45],
    ['star-scout', '星耳兔', 'common', 43000, 27],
    ['star-friend', '星尾狐', 'rare', 65000, 18],
    ['star-wing', '星羽鲸', 'epic', 100000, 8],
    ['star-guardian', '星辉龙', 'legendary', 160000, 2],
  ]),
  egg('core-egg', '地心蛋', 22000, [
    ['core-blob', '核团', 'common', 34000, 40],
    ['core-scout', '辉壳虫', 'common', 50000, 30],
    ['core-friend', '地心狮', 'rare', 76000, 20],
    ['core-wing', '耀羽凰', 'epic', 120000, 8],
    ['core-guardian', '地心巨龙', 'legendary', 190000, 2],
  ]),
 ];
export const PET_CONTENT: PetContent = {
  equipSlots: 3,
  pets: offers.flatMap(entry => entry.pets),
  eggs: offers.map(entry => entry.offer),
};

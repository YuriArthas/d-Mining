import { EGG_STAGES, STAGES } from './progression.ts';
import { LAYERS } from './layers.ts';
import type { PetContent, PetDefinition, EggDefinition, PetRarity } from '../logic/pets/types.ts';

// Appearance identities and real draw weights; all economic values come from progression.
// Tuple: species ID, name, rarity, draw weight.
type Reward = readonly [string, string, PetRarity, number];
function egg(id: string, name: string, rewards: readonly Reward[]) {
  const pets: PetDefinition[] = rewards.map(([id, name, rarity]) => ({ id, name, rarity, powerBonusBps: 0 }));
  const offer: EggDefinition = { id, name, price: 0, outcomes: rewards.map(([speciesId, , , weight]) => ({ speciesId, weight })) };
  return { pets, offer };
}
const offers = [
  egg('meadow-egg', '原野蛋', [
    ['moss-slime', '苔团', 'common', 40],
    ['quarry-mole', '矿洞鼹鼠', 'common', 30],
    ['amber-fox', '琥珀狐', 'rare', 20],
    ['crystal-owl', '晶羽猫头鹰', 'epic', 8],
    ['moon-dragon', '月光幼龙', 'legendary', 2],
  ]),
  egg('pebble-egg', '卵石蛋', [
    ['pebble-blob', '石团', 'common', 42],
    ['pebble-scout', '砂鼠', 'common', 28],
    ['pebble-friend', '斑岩兔', 'rare', 20],
    ['pebble-wing', '青石龟', 'epic', 8],
    ['pebble-guardian', '磐岩熊', 'legendary', 2],
  ]),
  egg('copper-egg', '铜矿蛋', [
    ['copper-blob', '铜团', 'common', 38],
    ['copper-scout', '铜尾鼠', 'common', 32],
    ['copper-friend', '赤铜狐', 'rare', 20],
    ['copper-wing', '黄铜鸟', 'epic', 8],
    ['copper-guardian', '铜角牛', 'legendary', 2],
  ]),
  egg('amber-egg', '琥珀蛋', [
    ['amber-blob', '蜜团', 'common', 45],
    ['amber-scout', '琥珀蜂', 'common', 25],
    ['amber-friend', '蜜蜡兔', 'rare', 19],
    ['amber-wing', '金翅蝶', 'epic', 9],
    ['amber-guardian', '琥珀狮', 'legendary', 2],
  ]),
  egg('tide-egg', '潮汐蛋', [
    ['tide-blob', '水团', 'common', 40],
    ['tide-scout', '泡泡鱼', 'common', 30],
    ['tide-friend', '珊瑚蟹', 'rare', 18],
    ['tide-wing', '浪花鲸', 'epic', 10],
    ['tide-guardian', '潮汐龙', 'legendary', 2],
  ]),
  egg('fire-egg', '火花蛋', [
    ['fire-blob', '火团', 'common', 44],
    ['fire-scout', '炭球鼠', 'common', 28],
    ['fire-friend', '火尾狐', 'rare', 18],
    ['fire-wing', '赤焰鸟', 'epic', 8],
    ['fire-guardian', '火花龙', 'legendary', 2],
  ]),
  egg('mushroom-egg', '蘑菇蛋', [
    ['mushroom-blob', '菇团', 'common', 40],
    ['mushroom-scout', '伞菇鼠', 'common', 33],
    ['mushroom-friend', '绒菇兔', 'rare', 18],
    ['mushroom-wing', '荧光蛙', 'epic', 7],
    ['mushroom-guardian', '蘑菇鹿', 'legendary', 2],
  ]),
  egg('silver-egg', '白银蛋', [
    ['silver-blob', '银团', 'common', 40],
    ['silver-scout', '银尾鼠', 'common', 30],
    ['silver-friend', '银耳兔', 'rare', 20],
    ['silver-wing', '银羽鹰', 'epic', 8],
    ['silver-guardian', '银角鹿', 'legendary', 2],
  ]),
  egg('crystal-egg', '水晶蛋', [
    ['crystal-blob', '晶团', 'common', 43],
    ['crystal-scout', '晶壳虫', 'common', 29],
    ['crystal-friend', '紫晶狐', 'rare', 18],
    ['crystal-wing', '晶羽鹤', 'epic', 8],
    ['crystal-guardian', '水晶龙', 'legendary', 2],
  ]),
  egg('frost-egg', '冰霜蛋', [
    ['frost-blob', '雪团', 'common', 40],
    ['frost-scout', '冰尾鼠', 'common', 30],
    ['frost-friend', '雪绒兔', 'rare', 20],
    ['frost-wing', '冰羽鹰', 'epic', 8],
    ['frost-guardian', '霜角熊', 'legendary', 2],
  ]),
  egg('ruin-egg', '遗迹蛋', [
    ['ruin-blob', '砂团', 'common', 42],
    ['ruin-scout', '石纹鼠', 'common', 30],
    ['ruin-friend', '古印猫', 'rare', 18],
    ['ruin-wing', '符文鹰', 'epic', 8],
    ['ruin-guardian', '遗迹兽', 'legendary', 2],
  ]),
  egg('lava-egg', '熔岩蛋', [
    ['lava-blob', '熔团', 'common', 40],
    ['lava-scout', '熔壳虫', 'common', 30],
    ['lava-friend', '岩浆蜥', 'rare', 19],
    ['lava-wing', '熔翼蝠', 'epic', 9],
    ['lava-guardian', '熔岩龙', 'legendary', 2],
  ]),
  egg('fossil-egg', '化石蛋', [
    ['fossil-blob', '骨团', 'common', 43],
    ['fossil-scout', '骨尾鼠', 'common', 29],
    ['fossil-friend', '化石龟', 'rare', 18],
    ['fossil-wing', '骨翼鸟', 'epic', 8],
    ['fossil-guardian', '远古龙', 'legendary', 2],
  ]),
  egg('gear-egg', '齿轮蛋', [
    ['gear-blob', '铁团', 'common', 40],
    ['gear-scout', '发条鼠', 'common', 32],
    ['gear-friend', '齿轮猫', 'rare', 18],
    ['gear-wing', '机械鹰', 'epic', 8],
    ['gear-guardian', '钢铁熊', 'legendary', 2],
  ]),
  egg('star-egg', '星辉蛋', [
    ['star-blob', '星团', 'common', 45],
    ['star-scout', '星耳兔', 'common', 27],
    ['star-friend', '星尾狐', 'rare', 18],
    ['star-wing', '星羽鲸', 'epic', 8],
    ['star-guardian', '星辉龙', 'legendary', 2],
  ]),
  egg('core-egg', '地心蛋', [
    ['core-blob', '核团', 'common', 40],
    ['core-scout', '辉壳虫', 'common', 30],
    ['core-friend', '地心狮', 'rare', 20],
    ['core-wing', '耀羽凰', 'epic', 8],
    ['core-guardian', '地心巨龙', 'legendary', 2],
  ]),
 ];
const progressionOffers = offers.map(entry => {
  const [index, premium] = EGG_STAGES[entry.offer.id], stage = STAGES[index];
  return {
    pets: entry.pets.map((pet, i) => ({...pet, powerBonusBps: Math.round(stage.petBonusBps * (premium ? 2 : 1) * [1, 1.2, 1.6, 2.3, 3.5][i])})),
    offer: {...entry.offer, price: stage.eggPrice * (premium ? 8 : 1),
      requiredDestination: index === 0 ? undefined : LAYERS[index].id,
      unlockName: index === 0 ? undefined : LAYERS[index].name},
  };
});
export const PET_CONTENT: PetContent = {
  equipSlots: 3,
  pets: progressionOffers.flatMap(entry => entry.pets),
  eggs: progressionOffers.map(entry => entry.offer),
};

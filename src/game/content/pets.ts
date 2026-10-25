import type { PetRarity } from '../logic/pets/types.ts';

/** Every egg and the pets in it: identity, names, rarity and where the egg belongs (its world and layer; a
 *  premium egg is a layer's second, pricier egg). Prices, draw weights and bonuses are in economy.json, joined
 *  in petContent.ts. No numbers here: tools/economy/model.mts reads this file. */
export type EggDefinition = Readonly<{
  id: string; name: string; world: 1 | 2 | 3; layer: number; premium: boolean;
  pets: readonly (readonly [id: string, name: string, rarity: PetRarity])[];
}>;
const egg = (id: string, name: string, world: 1 | 2 | 3, layer: number, premium: boolean, pets: EggDefinition['pets']): EggDefinition =>
  Object.freeze({ id, name, world, layer, premium, pets });
export const EGG_DEFINITIONS: readonly EggDefinition[] = Object.freeze([
  egg('meadow-egg', '原野蛋', 1, 0, false, [
    ['moss-slime', '苔团', 'common'],
    ['quarry-mole', '矿洞鼹鼠', 'common'],
    ['amber-fox', '琥珀狐', 'rare'],
    ['crystal-owl', '晶羽猫头鹰', 'epic'],
    ['moon-dragon', '月光幼龙', 'legendary'],
  ]),
  egg('pebble-egg', '卵石蛋', 1, 1, false, [
    ['pebble-blob', '石团', 'common'],
    ['pebble-scout', '砂鼠', 'common'],
    ['pebble-friend', '斑岩兔', 'rare'],
    ['pebble-wing', '青石龟', 'epic'],
    ['pebble-guardian', '磐岩熊', 'legendary'],
  ]),
  egg('mushroom-egg', '蘑菇蛋', 1, 2, false, [
    ['mushroom-blob', '菇团', 'common'],
    ['mushroom-scout', '伞菇鼠', 'common'],
    ['mushroom-friend', '绒菇兔', 'rare'],
    ['mushroom-wing', '荧光蛙', 'epic'],
    ['mushroom-guardian', '蘑菇鹿', 'legendary'],
  ]),
  egg('crystal-egg', '水晶蛋', 1, 3, false, [
    ['crystal-blob', '晶团', 'common'],
    ['crystal-scout', '晶壳虫', 'common'],
    ['crystal-friend', '紫晶狐', 'rare'],
    ['crystal-wing', '晶羽鹤', 'epic'],
    ['crystal-guardian', '水晶龙', 'legendary'],
  ]),
  egg('ruin-egg', '遗迹蛋', 1, 4, false, [
    ['ruin-blob', '砂团', 'common'],
    ['ruin-scout', '石纹鼠', 'common'],
    ['ruin-friend', '古印猫', 'rare'],
    ['ruin-wing', '符文鹰', 'epic'],
    ['ruin-guardian', '遗迹兽', 'legendary'],
  ]),
  egg('frost-egg', '冰霜蛋', 1, 5, false, [
    ['frost-blob', '雪团', 'common'],
    ['frost-scout', '冰尾鼠', 'common'],
    ['frost-friend', '雪绒兔', 'rare'],
    ['frost-wing', '冰羽鹰', 'epic'],
    ['frost-guardian', '霜角熊', 'legendary'],
  ]),
  egg('fire-egg', '火花蛋', 1, 6, false, [
    ['fire-blob', '火团', 'common'],
    ['fire-scout', '炭球鼠', 'common'],
    ['fire-friend', '火尾狐', 'rare'],
    ['fire-wing', '赤焰鸟', 'epic'],
    ['fire-guardian', '火花龙', 'legendary'],
  ]),
  egg('copper-egg', '铜矿蛋', 2, 0, false, [
    ['copper-blob', '铜团', 'common'],
    ['copper-scout', '铜尾鼠', 'common'],
    ['copper-friend', '赤铜狐', 'rare'],
    ['copper-wing', '黄铜鸟', 'epic'],
    ['copper-guardian', '铜角牛', 'legendary'],
  ]),
  egg('gear-egg', '齿轮蛋', 2, 1, false, [
    ['gear-blob', '铁团', 'common'],
    ['gear-scout', '发条鼠', 'common'],
    ['gear-friend', '齿轮猫', 'rare'],
    ['gear-wing', '机械鹰', 'epic'],
    ['gear-guardian', '钢铁熊', 'legendary'],
  ]),
  egg('silver-egg', '白银蛋', 2, 2, false, [
    ['silver-blob', '银团', 'common'],
    ['silver-scout', '银尾鼠', 'common'],
    ['silver-friend', '银耳兔', 'rare'],
    ['silver-wing', '银羽鹰', 'epic'],
    ['silver-guardian', '银角鹿', 'legendary'],
  ]),
  egg('tide-egg', '潮汐蛋', 2, 3, false, [
    ['tide-blob', '水团', 'common'],
    ['tide-scout', '泡泡鱼', 'common'],
    ['tide-friend', '珊瑚蟹', 'rare'],
    ['tide-wing', '浪花鲸', 'epic'],
    ['tide-guardian', '潮汐龙', 'legendary'],
  ]),
  egg('amber-egg', '琥珀蛋', 2, 4, false, [
    ['amber-blob', '蜜团', 'common'],
    ['amber-scout', '琥珀蜂', 'common'],
    ['amber-friend', '蜜蜡兔', 'rare'],
    ['amber-wing', '金翅蝶', 'epic'],
    ['amber-guardian', '琥珀狮', 'legendary'],
  ]),
  egg('lava-egg', '熔岩蛋', 2, 6, false, [
    ['lava-blob', '熔团', 'common'],
    ['lava-scout', '熔壳虫', 'common'],
    ['lava-friend', '岩浆蜥', 'rare'],
    ['lava-wing', '熔翼蝠', 'epic'],
    ['lava-guardian', '熔岩龙', 'legendary'],
  ]),
  egg('star-egg', '星辉蛋', 3, 0, false, [
    ['star-blob', '星团', 'common'],
    ['star-scout', '星耳兔', 'common'],
    ['star-friend', '星尾狐', 'rare'],
    ['star-wing', '星羽鲸', 'epic'],
    ['star-guardian', '星辉龙', 'legendary'],
  ]),
  egg('fossil-egg', '化石蛋', 3, 1, false, [
    ['fossil-blob', '骨团', 'common'],
    ['fossil-scout', '骨尾鼠', 'common'],
    ['fossil-friend', '化石龟', 'rare'],
    ['fossil-wing', '骨翼鸟', 'epic'],
    ['fossil-guardian', '远古龙', 'legendary'],
  ]),
  egg('core-egg', '地心蛋', 3, 6, false, [
    ['core-blob', '核团', 'common'],
    ['core-scout', '辉壳虫', 'common'],
    ['core-friend', '地心狮', 'rare'],
    ['core-wing', '耀羽凰', 'epic'],
    ['core-guardian', '地心巨龙', 'legendary'],
  ]),
]);

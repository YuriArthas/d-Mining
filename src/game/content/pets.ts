import type { PetRarity } from '../logic/pets/types.ts';

import { tr } from '../i18n/i18n.ts';
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
  egg('meadow-egg', tr('原野蛋'), 1, 0, false, [
    ['moss-slime', tr('苔团'), 'common'],
    ['quarry-mole', tr('矿洞鼹鼠'), 'common'],
    ['amber-fox', tr('琥珀狐'), 'rare'],
    ['crystal-owl', tr('晶羽猫头鹰'), 'epic'],
    ['moon-dragon', tr('月光幼龙'), 'legendary'],
  ]),
  egg('pebble-egg', tr('卵石蛋'), 1, 1, false, [
    ['pebble-blob', tr('石团'), 'common'],
    ['pebble-scout', tr('砂鼠'), 'common'],
    ['pebble-friend', tr('斑岩兔'), 'rare'],
    ['pebble-wing', tr('青石龟'), 'epic'],
    ['pebble-guardian', tr('磐岩熊'), 'legendary'],
  ]),
  egg('mushroom-egg', tr('蘑菇蛋'), 1, 2, false, [
    ['mushroom-blob', tr('菇团'), 'common'],
    ['mushroom-scout', tr('伞菇鼠'), 'common'],
    ['mushroom-friend', tr('绒菇兔'), 'rare'],
    ['mushroom-wing', tr('荧光蛙'), 'epic'],
    ['mushroom-guardian', tr('蘑菇鹿'), 'legendary'],
  ]),
  egg('crystal-egg', tr('水晶蛋'), 1, 3, false, [
    ['crystal-blob', tr('晶团'), 'common'],
    ['crystal-scout', tr('晶壳虫'), 'common'],
    ['crystal-friend', tr('紫晶狐'), 'rare'],
    ['crystal-wing', tr('晶羽鹤'), 'epic'],
    ['crystal-guardian', tr('水晶龙'), 'legendary'],
  ]),
  egg('ruin-egg', tr('遗迹蛋'), 1, 4, false, [
    ['ruin-blob', tr('砂团'), 'common'],
    ['ruin-scout', tr('石纹鼠'), 'common'],
    ['ruin-friend', tr('古印猫'), 'rare'],
    ['ruin-wing', tr('符文鹰'), 'epic'],
    ['ruin-guardian', tr('遗迹兽'), 'legendary'],
  ]),
  egg('frost-egg', tr('冰霜蛋'), 1, 5, false, [
    ['frost-blob', tr('雪团'), 'common'],
    ['frost-scout', tr('冰尾鼠'), 'common'],
    ['frost-friend', tr('雪绒兔'), 'rare'],
    ['frost-wing', tr('冰羽鹰'), 'epic'],
    ['frost-guardian', tr('霜角熊'), 'legendary'],
  ]),
  egg('fire-egg', tr('火花蛋'), 1, 6, false, [
    ['fire-blob', tr('火团'), 'common'],
    ['fire-scout', tr('炭球鼠'), 'common'],
    ['fire-friend', tr('火尾狐'), 'rare'],
    ['fire-wing', tr('赤焰鸟'), 'epic'],
    ['fire-guardian', tr('火花龙'), 'legendary'],
  ]),
  egg('copper-egg', tr('铜矿蛋'), 2, 0, false, [
    ['copper-blob', tr('铜团'), 'common'],
    ['copper-scout', tr('铜尾鼠'), 'common'],
    ['copper-friend', tr('赤铜狐'), 'rare'],
    ['copper-wing', tr('黄铜鸟'), 'epic'],
    ['copper-guardian', tr('铜角牛'), 'legendary'],
  ]),
  egg('gear-egg', tr('齿轮蛋'), 2, 1, false, [
    ['gear-blob', tr('铁团'), 'common'],
    ['gear-scout', tr('发条鼠'), 'common'],
    ['gear-friend', tr('齿轮猫'), 'rare'],
    ['gear-wing', tr('机械鹰'), 'epic'],
    ['gear-guardian', tr('钢铁熊'), 'legendary'],
  ]),
  egg('silver-egg', tr('白银蛋'), 2, 2, false, [
    ['silver-blob', tr('银团'), 'common'],
    ['silver-scout', tr('银尾鼠'), 'common'],
    ['silver-friend', tr('银耳兔'), 'rare'],
    ['silver-wing', tr('银羽鹰'), 'epic'],
    ['silver-guardian', tr('银角鹿'), 'legendary'],
  ]),
  egg('tide-egg', tr('潮汐蛋'), 2, 3, false, [
    ['tide-blob', tr('水团'), 'common'],
    ['tide-scout', tr('泡泡鱼'), 'common'],
    ['tide-friend', tr('珊瑚蟹'), 'rare'],
    ['tide-wing', tr('浪花鲸'), 'epic'],
    ['tide-guardian', tr('潮汐龙'), 'legendary'],
  ]),
  egg('amber-egg', tr('琥珀蛋'), 2, 4, false, [
    ['amber-blob', tr('蜜团'), 'common'],
    ['amber-scout', tr('琥珀蜂'), 'common'],
    ['amber-friend', tr('蜜蜡兔'), 'rare'],
    ['amber-wing', tr('金翅蝶'), 'epic'],
    ['amber-guardian', tr('琥珀狮'), 'legendary'],
  ]),
  egg('lava-egg', tr('熔岩蛋'), 2, 6, false, [
    ['lava-blob', tr('熔团'), 'common'],
    ['lava-scout', tr('熔壳虫'), 'common'],
    ['lava-friend', tr('岩浆蜥'), 'rare'],
    ['lava-wing', tr('熔翼蝠'), 'epic'],
    ['lava-guardian', tr('熔岩龙'), 'legendary'],
  ]),
  egg('star-egg', tr('星辉蛋'), 3, 0, false, [
    ['star-blob', tr('星团'), 'common'],
    ['star-scout', tr('星耳兔'), 'common'],
    ['star-friend', tr('星尾狐'), 'rare'],
    ['star-wing', tr('星羽鲸'), 'epic'],
    ['star-guardian', tr('星辉龙'), 'legendary'],
  ]),
  egg('fossil-egg', tr('化石蛋'), 3, 1, false, [
    ['fossil-blob', tr('骨团'), 'common'],
    ['fossil-scout', tr('骨尾鼠'), 'common'],
    ['fossil-friend', tr('化石龟'), 'rare'],
    ['fossil-wing', tr('骨翼鸟'), 'epic'],
    ['fossil-guardian', tr('远古龙'), 'legendary'],
  ]),
  egg('core-egg', tr('地心蛋'), 3, 6, false, [
    ['core-blob', tr('核团'), 'common'],
    ['core-scout', tr('辉壳虫'), 'common'],
    ['core-friend', tr('地心狮'), 'rare'],
    ['core-wing', tr('耀羽凰'), 'epic'],
    ['core-guardian', tr('地心巨龙'), 'legendary'],
  ]),
  egg('cryo-egg', tr('冷凝蛋'), 2, 5, false, [
    ['cryo-blob', tr('凝团'), 'common'],
    ['cryo-scout', tr('冷凝鼠'), 'common'],
    ['cryo-friend', tr('霜壳兔'), 'rare'],
    ['cryo-wing', tr('冰晶鹤'), 'epic'],
    ['cryo-guardian', tr('冷凝熊'), 'legendary'],
  ]),
  egg('probe-egg', tr('探测蛋'), 2, 4, true, [
    ['probe-blob', tr('探团'), 'common'],
    ['probe-scout', tr('雷达鼠'), 'common'],
    ['probe-friend', tr('天线猫'), 'rare'],
    ['probe-wing', tr('探测鹰'), 'epic'],
    ['probe-guardian', tr('勘探牛'), 'legendary'],
  ]),
  egg('nitro-egg', tr('液氮蛋'), 2, 5, true, [
    ['nitro-blob', tr('氮团'), 'common'],
    ['nitro-scout', tr('冻壳虫'), 'common'],
    ['nitro-friend', tr('冰雾狐'), 'rare'],
    ['nitro-wing', tr('寒光鲸'), 'epic'],
    ['nitro-guardian', tr('极寒龙'), 'legendary'],
  ]),
  egg('fusion-egg', tr('聚变蛋'), 2, 6, true, [
    ['fusion-blob', tr('能团'), 'common'],
    ['fusion-scout', tr('电光鼠'), 'common'],
    ['fusion-friend', tr('聚变猫'), 'rare'],
    ['fusion-wing', tr('等离子凰'), 'epic'],
    ['fusion-guardian', tr('反应堆兽'), 'legendary'],
  ]),
  egg('orbit-egg', tr('星轨蛋'), 3, 2, false, [
    ['orbit-blob', tr('轨团'), 'common'],
    ['orbit-scout', tr('星轨鼠'), 'common'],
    ['orbit-friend', tr('齿星猫'), 'rare'],
    ['orbit-wing', tr('卫星鸟'), 'epic'],
    ['orbit-guardian', tr('星轨熊'), 'legendary'],
  ]),
  egg('geode-egg', tr('晶簇蛋'), 3, 3, false, [
    ['geode-blob', tr('簇团'), 'common'],
    ['geode-scout', tr('晶簇虫'), 'common'],
    ['geode-friend', tr('碎晶兔'), 'rare'],
    ['geode-wing', tr('晶翼蝶'), 'epic'],
    ['geode-guardian', tr('晶簇鹿'), 'legendary'],
  ]),
  egg('rune-egg', tr('星文蛋'), 3, 4, false, [
    ['rune-blob', tr('文团'), 'common'],
    ['rune-scout', tr('星文鼠'), 'common'],
    ['rune-friend', tr('符星狐'), 'rare'],
    ['rune-wing', tr('星文鹰'), 'epic'],
    ['rune-guardian', tr('星文狮'), 'legendary'],
  ]),
  egg('comet-egg', tr('彗冰蛋'), 3, 5, false, [
    ['comet-blob', tr('彗团'), 'common'],
    ['comet-scout', tr('冰彗兔'), 'common'],
    ['comet-friend', tr('彗尾狐'), 'rare'],
    ['comet-wing', tr('彗光鲸'), 'epic'],
    ['comet-guardian', tr('彗冰龙'), 'legendary'],
  ]),
  egg('meteor-egg', tr('流星蛋'), 3, 2, true, [
    ['meteor-blob', tr('陨团'), 'common'],
    ['meteor-scout', tr('火流鼠'), 'common'],
    ['meteor-friend', tr('流星兔'), 'rare'],
    ['meteor-wing', tr('流星雀'), 'epic'],
    ['meteor-guardian', tr('陨星龙'), 'legendary'],
  ]),
  egg('aurora-egg', tr('极光蛋'), 3, 3, true, [
    ['aurora-blob', tr('光团'), 'common'],
    ['aurora-scout', tr('极光蛙'), 'common'],
    ['aurora-friend', tr('极光狐'), 'rare'],
    ['aurora-wing', tr('极光蝶'), 'epic'],
    ['aurora-guardian', tr('极光鹿'), 'legendary'],
  ]),
  egg('nebula-egg', tr('星云蛋'), 3, 4, true, [
    ['nebula-blob', tr('云团'), 'common'],
    ['nebula-scout', tr('星云鱼'), 'common'],
    ['nebula-friend', tr('星云猫'), 'rare'],
    ['nebula-wing', tr('星云鲸'), 'epic'],
    ['nebula-guardian', tr('星云兽'), 'legendary'],
  ]),
  egg('galaxy-egg', tr('银河蛋'), 3, 5, true, [
    ['galaxy-blob', tr('河团'), 'common'],
    ['galaxy-scout', tr('银河蟹'), 'common'],
    ['galaxy-friend', tr('银河兔'), 'rare'],
    ['galaxy-wing', tr('银河鹤'), 'epic'],
    ['galaxy-guardian', tr('银河熊'), 'legendary'],
  ]),
  egg('void-egg', tr('黑洞蛋'), 3, 6, true, [
    ['void-blob', tr('虚团'), 'common'],
    ['void-scout', tr('暗影蝠'), 'common'],
    ['void-friend', tr('引力猫'), 'rare'],
    ['void-wing', tr('黑洞鹰'), 'epic'],
    ['void-guardian', tr('黑洞龙'), 'legendary'],
  ]),
]);

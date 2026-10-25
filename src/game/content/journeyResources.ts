// Names and looks of every layer's blocks and ores; their health and prices live in economy.json
// (resources.ts joins the two). No numbers here: this file is also read by tools/economy/model.mts.
const entries: readonly (readonly string[])[] = [
  ['泥土','coal:煤','copper:铜'], ['岩石','iron:铁','silver:银'], ['花岗岩','emerald:翡翠','amber:琥珀'],
  ['深层岩石','crystal:粉晶','amethyst:紫水晶'], ['砂岩','gold:金','ruby:红宝石'], ['冰岩','diamond:钻石','sapphire:蓝宝石'], ['玄武岩','sulfur:硫磺','obsidian:黑曜石'],
  ['赤土','tin:锡','nickel:镍'], ['铜质岩','cobalt:钴','zinc:锌'], ['沉积岩','titanium:钛','chrome:铬'],
  ['化石岩','fossil:化石碎片','platinum:铂'], ['层纹岩','tourmaline:碧玺','zircon:锆石'], ['晶化岩','aquamarine:海蓝宝石','opal:欧泊'], ['合金岩','iridium:铱','energy:能源晶石'],
  ['星尘土','stardust:星尘','stargold:星金'], ['陨石岩','meteorite:陨铁','moonstone:月石'], ['辉质岩','brightcobalt:辉钴','brighttitanium:辉钛'],
  ['星辉岩','star:星辉晶石','dark:暗晶'], ['镶晶岩','gravity:引力晶石','phase:相位晶石'], ['炽核岩','core:地心晶石','sun:日耀晶石'], ['源质岩','origin:源晶','eternal:永恒晶石'],
];
const colors = ['#ad8161','#929b91','#868f95','#626e79','#c7a274','#83b5c4','#50535a','#b98066','#af967a','#819394','#a16b58','#8a91a3','#7eb3be','#70838b','#9c8eaa','#7d8591','#758eac','#887ca4','#829ea6','#7a3b2e','#5c647c'];
/** Each ore's own colour and deposit look: metals glint, gems and crystals are glassy facets, the rest
 *  are plain veins. Within a world every two ores lie at least 20 apart in CIELAB, and every ore stands
 *  apart from its layer's rock by as much (tools/tests/ore-colours.test.mjs); deeper ores run brighter. The
 *  colour also follows the name: iron is tan like the familiar ore, tin pewter, nickel silver-green, titanium
 *  gunmetal, chrome a cold mirror, platinum warm white (白金); 粉晶 is rose quartz.
 *  The colour feeds the block texture, bag icons, pickup toasts and material lists alike. */
export const ORE_LOOKS: Readonly<Record<string, readonly [color: string, pattern: 'metal' | 'gem' | 'vein']>> = {
  coal: ['#2d2f33', 'vein'], copper: ['#ec6f2d', 'metal'], iron: ['#d9a77a', 'metal'], silver: ['#eef2f7', 'metal'], emerald: ['#22d37a', 'gem'], amber: ['#f2a93b', 'gem'], crystal: ['#ffb3e1', 'gem'],
  amethyst: ['#b061f2', 'gem'], gold: ['#ffd02e', 'metal'], ruby: ['#ff2d55', 'gem'], diamond: ['#a6f2ff', 'gem'], sapphire: ['#2f5dff', 'gem'], sulfur: ['#e3f24c', 'vein'], obsidian: ['#2a1440', 'gem'],
  tin: ['#a8a294', 'metal'], nickel: ['#b4dcae', 'metal'], cobalt: ['#3a6cff', 'metal'], zinc: ['#a29bbf', 'metal'], titanium: ['#4f5966', 'metal'], chrome: ['#d4e6ff', 'metal'], fossil: ['#e8cf9a', 'vein'],
  platinum: ['#f7efe0', 'metal'], tourmaline: ['#ff5aa5', 'gem'], zircon: ['#e0602f', 'gem'], aquamarine: ['#00b8ff', 'gem'], opal: ['#ffc6ea', 'gem'], iridium: ['#cdbdff', 'metal'], energy: ['#6cff3a', 'gem'],
  stardust: ['#f3d6ff', 'vein'], stargold: ['#ffb000', 'metal'], meteorite: ['#4a3b35', 'metal'], moonstone: ['#a9d4ff', 'gem'], brightcobalt: ['#5a95ff', 'metal'], brighttitanium: ['#b8fff0', 'metal'], star: ['#fff6c2', 'gem'],
  dark: ['#3b1366', 'gem'], gravity: ['#8e5cff', 'gem'], phase: ['#3cffd0', 'gem'], core: ['#ff5a1f', 'gem'], sun: ['#ffe23a', 'gem'], origin: ['#f5f8ff', 'gem'], eternal: ['#ff6be6', 'gem'],
};
type ItemLook = Readonly<{ itemId: string; name: string; color: string; pattern: string }>;
/** One layer's blocks: its rock, the dense rock deep in the layer, and its two ores (the second is the richer). */
export type LayerItems = Readonly<{ rock: ItemLook; deep: ItemLook; ores: readonly ItemLook[] }>;
/** Every layer of the three worlds, in order (world 1's seven, then world 2's, then world 3's). */
export const LAYER_ITEMS: readonly LayerItems[] = Object.freeze(entries.map(([base,...ores], i) => {
  const rockColor='#'+[1,3,5].map((offset,c)=>(parseInt(colors[i].slice(offset,offset+2),16)+2+(i+c)%3).toString(16).padStart(2,'0')).join('');
  const rock = { itemId:`journey.rock.${i}`, name:base, color:rockColor, pattern:'rock' };
  const deep = { itemId:rock.itemId+'.deep', name:'致密'+base, pattern:'rock',
    color:'#'+[1,3,5].map(offset=>Math.round(parseInt(rockColor.slice(offset,offset+2),16)*.65).toString(16).padStart(2,'0')).join('') };
  return Object.freeze({ rock: Object.freeze(rock), deep: Object.freeze(deep), ores: Object.freeze(ores.map(entry => {
    const [id,name]=entry.split(':'), look=ORE_LOOKS[id];
    if(!look)throw Error(`缺少矿石外观: ${id}`);
    return Object.freeze({ itemId:'journey.'+id, name, color:look[0], pattern:look[1] });
  })) });
}));

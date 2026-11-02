import { message, type TextRef } from '../i18n/messages.ts';
// Names and looks of every layer's blocks and ores; their health and prices live in economy.json
// (resources.ts joins the two). No numbers here: this file is also read by tools/economy/model.mts.
const entries: readonly (readonly [TextRef, ...(readonly [string, TextRef])[]])[] = [
  [message("msg.dirt"),['coal',message("msg.coal")],['copper',message("msg.copper")]], [message("msg.rock"),['iron',message("msg.iron")],['silver',message("msg.silver")]], [message("msg.granite"),['emerald',message("msg.emerald")],['amber',message("msg.amber")]],
  [message("msg.deep_rock"),['crystal',message("msg.rose_quartz")],['amethyst',message("msg.amethyst")]], [message("msg.sandstone"),['gold',message("msg.gold")],['ruby',message("msg.ruby")]], [message("msg.ice_rock"),['diamond',message("msg.diamond")],['sapphire',message("msg.sapphire")]], [message("msg.basalt"),['sulfur',message("msg.sulfur")],['obsidian',message("msg.obsidian")]],
  [message("msg.red_clay"),['tin',message("msg.tin")],['nickel',message("msg.nickel")]], [message("msg.cupric_rock"),['cobalt',message("msg.cobalt")],['zinc',message("msg.zinc")]], [message("msg.sedimentary_rock"),['titanium',message("msg.titanium")],['chrome',message("msg.chrome")]],
  [message("msg.fossil_rock"),['fossil',message("msg.fossil_shard")],['platinum',message("msg.platinum")]], [message("msg.banded_rock"),['tourmaline',message("msg.tourmaline")],['zircon',message("msg.zircon")]], [message("msg.crystalline_rock"),['aquamarine',message("msg.aquamarine")],['opal',message("msg.opal")]], [message("msg.alloy_rock"),['iridium',message("msg.iridium")],['energy',message("msg.energy_crystal")]],
  [message("msg.stardust_soil"),['stardust',message("msg.stardust")],['stargold',message("msg.stargold")]], [message("msg.meteor_rock"),['meteorite',message("msg.meteoric_iron")],['moonstone',message("msg.moonstone")]], [message("msg.glimmer_rock"),['brightcobalt',message("msg.bright_cobalt")],['brighttitanium',message("msg.bright_titanium")]],
  [message("msg.starglow_rock"),['star',message("msg.starglow_crystal")],['dark',message("msg.dark_crystal")]], [message("msg.inlaid_rock"),['gravity',message("msg.gravity_crystal")],['phase',message("msg.phase_crystal")]], [message("msg.blazecore_rock"),['core',message("msg.core_crystal")],['sun',message("msg.sunflare_crystal")]], [message("msg.origin_rock"),['origin',message("msg.origin_crystal")],['eternal',message("msg.eternal_crystal")]],
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
type ItemLook = Readonly<{ itemId: string; name: TextRef; color: string; pattern: string }>;
/** One layer's blocks: its rock, the dense rock deep in the layer, and its two ores (the second is the richer). */
export type LayerItems = Readonly<{ rock: ItemLook; deep: ItemLook; ores: readonly ItemLook[] }>;
/** Every layer of the three worlds, in order (world 1's seven, then world 2's, then world 3's). */
export const LAYER_ITEMS: readonly LayerItems[] = Object.freeze(entries.map(([base,...ores], i) => {
  const rockColor='#'+[1,3,5].map((offset,c)=>(parseInt(colors[i].slice(offset,offset+2),16)+2+(i+c)%3).toString(16).padStart(2,'0')).join('');
  const rock = { itemId:`journey.rock.${i}`, name:base, color:rockColor, pattern:'rock' };
  const deep = { itemId:rock.itemId+'.deep', name:message("msg.dense_rock",{rock:base}), pattern:'rock',
    color:'#'+[1,3,5].map(offset=>Math.round(parseInt(rockColor.slice(offset,offset+2),16)*.65).toString(16).padStart(2,'0')).join('') };
  return Object.freeze({ rock: Object.freeze(rock), deep: Object.freeze(deep), ores: Object.freeze(ores.map(entry => {
    const [id,name]=entry, look=ORE_LOOKS[id];
    if(!look)throw Error(`缺少矿石外观: ${id}`);
    return Object.freeze({ itemId:'journey.'+id, name, color:look[0], pattern:look[1] });
  })) });
}));

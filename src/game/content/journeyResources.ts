import { pickaxeStats } from '../logic/Pickaxe.ts';
// First playable values. A base block's volume is also its lifetime mining contribution.
const amounts = [1,5,20,80,300,1200,5000,12_000,30_000,80_000,200_000,500_000,1_200_000,3_000_000,8_000_000,20_000_000,50_000_000,120_000_000,300_000_000,800_000_000,2_000_000_000];
const entries = [
  ['泥土','coal:煤','copper:铜'], ['岩石','iron:铁','silver:银'], ['花岗岩','emerald:翡翠','amber:琥珀'],
  ['深层岩石','crystal:水晶','amethyst:紫水晶'], ['砂岩','gold:金','ruby:红宝石'], ['冰岩','diamond:钻石','sapphire:蓝宝石'], ['玄武岩','sulfur:硫磺','obsidian:黑曜石'],
  ['赤土','tin:锡','nickel:镍'], ['铜质岩','cobalt:钴','zinc:锌'], ['沉积岩','titanium:钛','chrome:铬'],
  ['化石岩','fossil:化石碎片','platinum:铂'], ['层纹岩','tourmaline:碧玺','zircon:锆石'], ['晶化岩','aquamarine:海蓝宝石','opal:欧泊'], ['合金岩','iridium:铱','energy:能源晶石'],
  ['星尘土','stardust:星尘','stargold:星金'], ['陨石岩','meteorite:陨铁','moonstone:月石'], ['辉质岩','brightcobalt:辉钴','brighttitanium:辉钛'],
  ['星辉岩','star:星辉晶石','dark:暗晶'], ['镶晶岩','gravity:引力晶石','phase:相位晶石'], ['炽核岩','core:地心晶石','sun:日耀晶石'], ['源质岩','origin:源晶','eternal:永恒晶石'],
];
const colors = ['#ad8161','#929b91','#868f95','#626e79','#c7a274','#83b5c4','#50535a','#b98066','#af967a','#819394','#a16b58','#8a91a3','#7eb3be','#70838b','#9c8eaa','#7d8591','#758eac','#887ca4','#829ea6','#a68178','#5c647c'];
/** Each ore's own colour and deposit look: metals glint, gems and crystals are glassy facets, the rest
 *  are plain veins. Within a world every two ores lie at least 20 apart in CIELAB, and every ore stands
 *  apart from its layer's rock by as much (tools/tests/ore-colours.test.mjs); deeper ores run brighter.
 *  The colour feeds the block texture, bag icons, pickup toasts and material lists alike. */
export const ORE_LOOKS: Readonly<Record<string, readonly [color: string, pattern: 'metal' | 'gem' | 'vein']>> = {
  coal: ['#2d2f33', 'vein'], copper: ['#ec6f2d', 'metal'], iron: ['#a84a2e', 'metal'], silver: ['#eef2f7', 'metal'], emerald: ['#22d37a', 'gem'], amber: ['#f2a93b', 'gem'], crystal: ['#ffb3e1', 'gem'],
  amethyst: ['#b061f2', 'gem'], gold: ['#ffd02e', 'metal'], ruby: ['#ff2d55', 'gem'], diamond: ['#a6f2ff', 'gem'], sapphire: ['#2f5dff', 'gem'], sulfur: ['#e3f24c', 'vein'], obsidian: ['#2a1440', 'gem'],
  tin: ['#6b4a3b', 'metal'], nickel: ['#7ccf86', 'metal'], cobalt: ['#3a6cff', 'metal'], zinc: ['#b7b0c9', 'metal'], titanium: ['#a07dff', 'metal'], chrome: ['#4f5966', 'metal'], fossil: ['#e8cf9a', 'vein'],
  platinum: ['#dcecff', 'metal'], tourmaline: ['#ff5aa5', 'gem'], zircon: ['#e0602f', 'gem'], aquamarine: ['#00b8ff', 'gem'], opal: ['#ffc6ea', 'gem'], iridium: ['#cdbdff', 'metal'], energy: ['#6cff3a', 'gem'],
  stardust: ['#f3d6ff', 'vein'], stargold: ['#ffb000', 'metal'], meteorite: ['#4a3b35', 'metal'], moonstone: ['#a9d4ff', 'gem'], brightcobalt: ['#2f6dff', 'metal'], brighttitanium: ['#b8fff0', 'metal'], star: ['#fff6c2', 'gem'],
  dark: ['#3b1366', 'gem'], gravity: ['#8e5cff', 'gem'], phase: ['#3cffd0', 'gem'], core: ['#ff5a1f', 'gem'], sun: ['#ffe23a', 'gem'], origin: ['#f5f8ff', 'gem'], eternal: ['#ff6be6', 'gem'],
};
export const JOURNEY_RESOURCES = Object.freeze(entries.flatMap(([base,...ores], i) => {
  const world = Math.floor(i / 7), local = i % 7, level = world * 10 + Math.max(1, Math.round(local * 9 / 6) + 1);
  const health = Math.round(pickaxeStats(level).power * (1 + 1.5 * 3 ** Math.min(i,6)) * (i ? 5 : 1));
  const requiredLevel = world * 10;
  const rock = { kind:64+i*4, itemId:`journey.rock.${i}`, name:base, color:'#'+[1,3,5].map((offset,c)=>(parseInt(colors[i].slice(offset,offset+2),16)+2+(i+c)%3).toString(16).padStart(2,'0')).join(''), volume:amounts[i], maxHp:health, price:amounts[i], pattern:'rock', base:true, requiredLevel };
  return [rock, {...rock, kind:rock.kind+1, itemId:rock.itemId+'.deep', name:'致密'+base, color:'#'+[1,3,5].map(offset=>Math.round(parseInt(rock.color.slice(offset,offset+2),16)*.65).toString(16).padStart(2,'0')).join(''), maxHp:health*5, price:Math.max(1,Math.round(amounts[i]/10))},
    ...ores.map((entry,j) => { const [id,name]=entry.split(':'), look=ORE_LOOKS[id]; if(!look)throw Error(`缺少矿石外观: ${id}`); return {...rock, kind:rock.kind+2+j,itemId:'journey.'+id,name,base:false,pattern:look[1],color:look[0],volume:amounts[i]*(j+2),price:amounts[i]*(j?6:3),maxHp:health*(j+2)}; })];
}).map(resource=>Object.freeze(resource)));
export const JOURNEY_CAPACITIES = [50,150,600,2500,10_000,40_000,100_000,250_000,600_000,1_000_000,3_000_000,8_000_000,20_000_000,50_000_000,100_000_000,200_000_000,350_000_000,500_000_000,750_000_000,1_000_000_000,3_000_000_000,8_000_000_000,20_000_000_000,50_000_000_000,100_000_000_000,200_000_000_000,350_000_000_000,500_000_000_000,750_000_000_000,1_000_000_000_000] as const;
const firstToolPrices = [0,50,200,800,3000,10_000,50_000,200_000,750_000,3_000_000];
const laterToolPrices = [6_000_000,12_000_000,25_000_000,50_000_000,100_000_000,200_000_000,400_000_000,800_000_000,1_500_000_000,3_000_000_000];
export const JOURNEY_TOOL_PRICES = Object.freeze([...firstToolPrices,...laterToolPrices,...laterToolPrices.map(price=>price*1000)]);
export const JOURNEY_BACKPACKS = Object.freeze(JOURNEY_CAPACITIES.slice(1).map((capacity,i)=>({id:`journey-bag-${i+2}`,capacity,price:Math.max(50,JOURNEY_TOOL_PRICES[i+1])})));

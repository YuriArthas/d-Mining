// Browser checks use real gameplay cooldowns; never inject rewards or a fake clock.
exports.digCells=async(page,cells)=>{
 for(const cell of cells){
  const deadline=Date.now()+20000;
  while(await page.evaluate(c=>window.__miningValidation.cell(c),cell)){
   if(Date.now()>deadline)throw Error(`Dig timed out: ${cell}`);
   const result=await page.evaluate(c=>window.__miningValidation.hit(c),cell);
   if(result.status==='full')throw Error('Backpack full during browser setup');
   const combat=await page.evaluate(()=>window.__miningValidation.snapshot().combat);
   await page.waitForTimeout(Math.max(20,(combat.nextAttackAt-combat.now)*1000+10));
  }
 }
};
const {ORE_ITEMS}=require('../src/game/application/items.ts');
exports.ores=ORE_ITEMS;
exports.totals=items=>Object.entries(items).reduce((sum,[id,count])=>{
 const ore=ORE_ITEMS.find(v=>v.itemId===id);if(!ore)throw Error(`Unknown test item ${id}`);
 return {count:sum.count+count,used:sum.used+count*ore.volume,coins:sum.coins+count*ore.price};
},{count:0,used:0,coins:0});

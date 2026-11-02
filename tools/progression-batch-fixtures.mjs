import {writeFileSync} from 'node:fs';
import {GameSession} from '../src/game/application/GameSession.ts';
import {GAME_CONTENT,GAME_GENERATION} from '../src/game/content/gameContent.ts';
import {worldRequirement,worldSpawn} from '../src/game/content/worldJourney.ts';
import {TIP_IDS,BASIC_TIP_IDS} from '../src/game/logic/Onboarding.ts';
const content=GAME_CONTENT.session;
const fresh=()=>new GameSession(content).exportProgress();
const quiet=()=>{const d=fresh();d.onboarding={...d.onboarding,status:'completed',seen:[...TIP_IDS],minedOnce:true,soldOnce:true};return d};
const fixtures={empty:quiet(),full:quiet(),shop:quiet(),egg:quiet(),station:quiet(),portal:quiet(),world2:quiet(),world3:quiet()};
fixtures.full.inventory.items={'journey.rock.0':5};
fixtures.shop.wallet.balances.gold=1000000;
fixtures.egg.onboarding.seen=['dig','sell','shop'];fixtures.egg.onboarding.status='active';fixtures.egg.wallet.balances.gold=10000;
fixtures.route=quiet();fixtures.route.worldProgress={version:2,openWorlds:[1,2,3]};
const first=content.destinations.find(d=>d.worldId===1);
for(const k of ['station','portal']) {fixtures[k].onboarding.seen=[...BASIC_TIP_IDS,...(k==='portal'?['station']:[])];fixtures[k].worldExploration['1']={version:1,maxDepth:first.depth,unlockedDestinationIds:[first.id]};}
for(const w of [2,3]) {const d=fixtures['world'+w],t=worldRequirement(w).ticket;d.onboarding.seen=[...BASIC_TIP_IDS,'station','portal'];d.worldProgress={version:2,openWorlds:w===3?[1,2]:[1]};d.pickaxe.level=d.equipment.toolLevel=t.toolLevel;d.wallet.balances[t.currency]=t.price;d.materials={version:1,items:Object.fromEntries(t.materials.map(m=>[m.itemId,m.count]))};}
writeFileSync('output/progression-batch-mobile/fixtures.json',JSON.stringify({fixtures,generation:GAME_GENERATION,shops:content.shops,destinations:content.destinations,spawns:[1,2,3].map(worldSpawn)},null,2));

import { mkdirSync, writeFileSync } from 'node:fs';
import { GameSession } from '../src/game/application/GameSession.ts';
import { GAME_CONTENT, GAME_GENERATION } from '../src/game/content/gameContent.ts';
import { worldPortal } from '../src/game/content/worldJourney.ts';
import { TIP_IDS } from '../src/game/logic/Onboarding.ts';
const quiet = () => {
  const d = new GameSession(GAME_CONTENT.session).exportProgress();
  d.onboarding = {...d.onboarding,status:'completed',seen:[...TIP_IDS],minedOnce:true,soldOnce:true};
  d.wallet.balances = {gold:0,tech:0,star:0};d.worldProgress = {version:2,openWorlds:[1,2,3]};return d;
};
const fixtures = {obsidian:quiet(),mixed:quiet()};
fixtures.obsidian.inventory.items = {'journey.obsidian':1};
fixtures.mixed.inventory.items = {'journey.obsidian':1,'journey.tin':2,'journey.stardust':3,'journey.rock.0':2};
fixtures.mixed.inventory.locked = ['journey.rock.0'];
mkdirSync('output/currency-sale',{recursive:true});
writeFileSync('output/currency-sale/fixtures.json',JSON.stringify({fixtures,generation:GAME_GENERATION,portal:worldPortal(1).zone},null,2));

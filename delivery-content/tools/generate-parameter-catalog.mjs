import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GAME_CONFIG } from '../src/game/config.ts';
import { MOVEMENT } from '../src/game/movement.ts';

const root = new URL('../', import.meta.url);
const rows = [];
const walk = (value, path, file, describe) => {
  if (typeof value === 'number') rows.push({ file, parameter: path, currentValue: value, ...describe(path) });
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value))
    walk(child, Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key, file, describe);
};
const economy = JSON.parse(readFileSync(new URL('src/game/content/economy.json', root), 'utf8'));
walk(economy, '', 'src/game/content/economy.json', p => {
  const leaf = p.split('.').at(-1);
  let unit = 'count / identifier', constraint = 'finite safe integer; keep matching IDs and ordering';
  if (leaf === 'price' || leaf === 'capsuleCoins' || leaf === 'coins') { unit = 'selected currency'; constraint = 'nonnegative safe integer, two significant figures for prices; follow progression validation'; }
  if (leaf === 'hp' || leaf === 'power') { unit = 'HP (power: HP/hit)'; constraint = 'positive safe integer, two significant figures; tools/enhancements strictly increase'; }
  if (leaf === 'capacity') { unit = 'ore items'; constraint = 'positive integer, strictly increasing across bags'; }
  if (leaf === 'speed') { unit = 'hits/second'; constraint = 'positive, nondecreasing, at most 4 * first tool speed'; }
  if (leaf === 'from' || leaf === 'deepAt') { unit = 'metres'; constraint = 'multiple of 2; layer depths increasing, deepAt inside layer (last null)'; }
  if (leaf === 'oreChance') { unit = 'fraction'; constraint = '0 < value < 1'; }
  if (leaf === 'weight') { unit = 'relative draw weight'; constraint = 'positive integer; probability = weight / sum(weights)'; }
  if (['bonusPct', 'miningPct', 'stepPct'].includes(leaf)) { unit = 'percentage points'; constraint = 'positive; pet percentages use round integer values'; }
  if (/Multiplier$/.test(leaf)) { unit = 'multiplier'; constraint = 'finite positive value; golden bonusMultiplier > 1'; }
  if (/Seconds$/.test(leaf)) { unit = 'seconds'; constraint = 'finite positive value'; }
  if (leaf === 'minutes') { unit = 'minutes'; constraint = 'finite positive value, increasing reward thresholds'; }
  const consumers = p.startsWith('tools') ? ['logic/Pickaxe.ts', 'application/GameSession.ts', 'content/shopCatalog.ts']
    : p.startsWith('layers') ? ['content/resources.ts', 'content/journeyWorlds.ts', 'terrain/strata.ts', 'application/GameSession.ts']
    : /^(eggs|golden|petSlots|start.petSlots)/.test(p) ? ['content/petContent.ts', 'logic/pets/petRules.ts', 'application/GameSession.ts']
    : p.startsWith('rebirth') ? ['logic/Rebirth.ts', 'application/GameSession.ts']
    : p.startsWith('worlds') ? ['content/worldJourney.ts', 'logic/WorldProgress.ts']
    : p.startsWith('bags') ? ['content/shopCatalog.ts', 'application/GameSession.ts', 'logic/Inventory.ts']
    : ['content/economy.ts', 'application/GameSession.ts', 'logic/Rewards.ts'];
  return { unit, constraint, consumers: consumers.map(f => 'src/game/' + f) };
});
walk(GAME_CONFIG, 'GAME_CONFIG', 'src/game/config.ts', p => ({
  unit: /Ms$/.test(p) ? 'milliseconds' : /Px$|stickRadius$/.test(p) ? 'CSS pixels' : /Sensitivity$/.test(p) ? 'radians/CSS pixel'
    : /fov$/.test(p) ? 'degrees' : /Pitch$|Yaw$/.test(p) ? 'radians' : /Sharpness$/.test(p) ? '1/second'
    : /RatioMax$|DeadZone$/.test(p) ? 'ratio' : 'metres',
  constraint: p.endsWith('stickDeadZone') ? '0 <= value < 1' : 'finite; see config.ts comments and docs/PARAMETERS.md for related bounds',
  consumers: ['src/game/validation/ValidationScene.tsx', 'src/game/bindInput.ts', 'src/game/validation/physics.ts'],
}));
walk(MOVEMENT, 'MOVEMENT', 'src/game/movement.ts', p => ({
  unit: /step$|maxFrameDelta$/.test(p) ? 'seconds' : /maxSteps$|snapGraceSteps$/.test(p) ? 'physics steps'
    : /gravity$/.test(p) ? 'metres/second^2' : /speed$|jumpSpeed$|terminalSpeed$/.test(p) ? 'metres/second'
    : /Slope$/.test(p) ? 'radians' : /Sharpness$/.test(p) ? '1/second' : 'metres',
  constraint: 'finite positive; maxSteps >= maxFrameDelta / step; maxSlope <= slideSlope',
  consumers: ['src/game/movement.ts', 'src/game/validation/physics.ts', 'src/game/validation/ValidationScene.tsx'],
}));
mkdirSync(new URL('docs/', root), { recursive: true });
writeFileSync(new URL('docs/parameter-catalog.json', root), JSON.stringify({
  generatedFromSource: true, editable: false, description: 'Read-only current values; edit the named source file. Consumers relative to project root.', parameters: rows,
}, null, 2) + '\n');
console.log(JSON.stringify({ parameters: rows.length }));

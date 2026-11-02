import { message, type TextRef } from '../../../src/game/i18n/messages.ts';
// Legacy-sized values solely for service unit tests. Live balance is tested in progression.test.mjs.
import type { PetContent, PetDefinition, EggDefinition, PetRarity } from '../../../src/game/logic/pets/types.ts';

// Each offer owns its explicit price and rewards, all in gold. Display row/height has no gameplay meaning.
// Tuple: species ID, name, rarity, income bonus in hundredths of a percent (1000 = +10 %), draw weight.
type Reward = readonly [string, TextRef, PetRarity, number, number];
function egg(id: string, name: TextRef, price: number, rewards: readonly Reward[]) {
  // Every fixture pet also mines 10 % faster.
  const pets: PetDefinition[] = rewards.map(([id, name, rarity, bonus]) => ({ id, name, rarity, bonusPct: bonus / 100, currency: 'gold', miningPct: 10 }));
  const offer: EggDefinition = { id, name, price, currency: 'gold', outcomes: rewards.map(([speciesId, , , , weight]) => ({ speciesId, weight })) };
  return { pets, offer };
}
const offers = [
  egg('meadow-egg', message("msg.meadow_egg"), 10, [
    ['moss-slime', message("msg.moss_blob"), 'common', 1000, 40],
    ['quarry-mole', message("msg.quarry_mole"), 'common', 1500, 30],
    ['amber-fox', message("msg.amber_fox"), 'rare', 2500, 20],
    ['crystal-owl', message("msg.crystal_owl"), 'epic', 4000, 8],
    ['moon-dragon', message("msg.moonlight_hatchling"), 'legendary', 7500, 2],
  ]),
  egg('pebble-egg', message("msg.pebble_egg"), 35, [
    ['pebble-blob', message("msg.stone_blob"), 'common', 1600, 42],
    ['pebble-scout', message("msg.sand_mouse"), 'common', 2300, 28],
    ['pebble-friend', message("msg.porphyry_bunny"), 'rare', 3600, 20],
    ['pebble-wing', message("msg.bluestone_turtle"), 'epic', 6000, 8],
    ['pebble-guardian', message("msg.boulder_bear"), 'legendary', 10000, 2],
  ]),
  egg('copper-egg', message("msg.copper_egg"), 95, [
    ['copper-blob', message("msg.copper_blob"), 'common', 2500, 38],
    ['copper-scout', message("msg.coppertail_mouse"), 'common', 3500, 32],
    ['copper-friend', message("msg.copper_fox"), 'rare', 5500, 20],
    ['copper-wing', message("msg.brass_bird"), 'epic', 8500, 8],
    ['copper-guardian', message("msg.copperhorn_bull"), 'legendary', 14000, 2],
  ]),
  egg('amber-egg', message("msg.amber_egg"), 180, [
    ['amber-blob', message("msg.honey_blob"), 'common', 3400, 45],
    ['amber-scout', message("msg.amber_bee"), 'common', 4800, 25],
    ['amber-friend', message("msg.beeswax_bunny"), 'rare', 7500, 19],
    ['amber-wing', message("msg.goldwing_butterfly"), 'epic', 11500, 9],
    ['amber-guardian', message("msg.amber_lion"), 'legendary', 18500, 2],
  ]),
  egg('tide-egg', message("msg.tide_egg"), 280, [
    ['tide-blob', message("msg.water_blob"), 'common', 4000, 40],
    ['tide-scout', message("msg.bubble_fish"), 'common', 6000, 30],
    ['tide-friend', message("msg.coral_crab"), 'rare', 9500, 18],
    ['tide-wing', message("msg.wave_whale"), 'epic', 14500, 10],
    ['tide-guardian', message("msg.tide_dragon"), 'legendary', 24000, 2],
  ]),
  egg('fire-egg', message("msg.spark_egg"), 450, [
    ['fire-blob', message("msg.fire_blob"), 'common', 5000, 44],
    ['fire-scout', message("msg.coalball_mouse"), 'common', 7500, 28],
    ['fire-friend', message("msg.firetail_fox"), 'rare', 11500, 18],
    ['fire-wing', message("msg.blaze_bird"), 'epic', 18000, 8],
    ['fire-guardian', message("msg.spark_dragon"), 'legendary', 29000, 2],
  ]),
  egg('mushroom-egg', message("msg.mushroom_egg"), 120, [
    ['mushroom-blob', message("msg.shroom_blob"), 'common', 2800, 40],
    ['mushroom-scout', message("msg.shroom_mouse"), 'common', 4000, 33],
    ['mushroom-friend', message("msg.fuzzcap_bunny"), 'rare', 6200, 18],
    ['mushroom-wing', message("msg.glow_frog"), 'epic', 10000, 7],
    ['mushroom-guardian', message("msg.mushroom_deer"), 'legendary', 16000, 2],
  ]),
  egg('silver-egg', message("msg.silver_egg"), 600, [
    ['silver-blob', message("msg.silver_blob"), 'common', 6000, 40],
    ['silver-scout', message("msg.silvertail_mouse"), 'common', 8500, 30],
    ['silver-friend', message("msg.silver_eared_bunny"), 'rare', 13500, 20],
    ['silver-wing', message("msg.silverwing_hawk"), 'epic', 21000, 8],
    ['silver-guardian', message("msg.silverhorn_deer"), 'legendary', 34000, 2],
  ]),
  egg('crystal-egg', message("msg.crystal_egg"), 900, [
    ['crystal-blob', message("msg.crystal_blob"), 'common', 7500, 43],
    ['crystal-scout', message("msg.crystalshell_bug"), 'common', 11000, 29],
    ['crystal-friend', message("msg.amethyst_fox"), 'rare', 16500, 18],
    ['crystal-wing', message("msg.crystal_crane"), 'epic', 25500, 8],
    ['crystal-guardian', message("msg.crystal_dragon"), 'legendary', 41000, 2],
  ]),
  egg('frost-egg', message("msg.frost_egg"), 1700, [
    ['frost-blob', message("msg.snow_blob"), 'common', 10000, 40],
    ['frost-scout', message("msg.frosttail_mouse"), 'common', 14500, 30],
    ['frost-friend', message("msg.fluffy_snow_bunny"), 'rare', 22000, 20],
    ['frost-wing', message("msg.frostwing_hawk"), 'epic', 34500, 8],
    ['frost-guardian', message("msg.frosthorn_bear"), 'legendary', 55000, 2],
  ]),
  egg('jade-egg', message("msg.crystal_egg"), 2400, [
    ['jade-blob', message("msg.crystal_blob"), 'common', 12500, 46],
    ['jade-scout', message("msg.crystal_owl"), 'common', 18000, 26],
    ['jade-friend', message("msg.amber_fox"), 'rare', 28000, 18],
    ['jade-wing', message("msg.crystal_owl"), 'epic', 43000, 8],
    ['jade-guardian', message("msg.mushroom_deer"), 'legendary', 68000, 2],
  ]),
  egg('moon-egg', message("msg.starglow_egg"), 3600, [
    ['moon-blob', message("msg.star_blob"), 'common', 15000, 40],
    ['moon-scout', message("msg.silver_eared_bunny"), 'common', 22500, 31],
    ['moon-friend', message("msg.amber_fox"), 'rare', 34000, 19],
    ['moon-wing', message("msg.crystal_owl"), 'epic', 52000, 8],
    ['moon-guardian', message("msg.moonlight_hatchling"), 'legendary', 85000, 2],
  ]),
  egg('ruin-egg', message("msg.ruin_egg"), 2100, [
    ['ruin-blob', message("msg.sand_blob"), 'common', 11500, 42],
    ['ruin-scout', message("msg.stonestripe_mouse"), 'common', 17000, 30],
    ['ruin-friend', message("msg.seal_cat"), 'rare', 25500, 18],
    ['ruin-wing', message("msg.rune_hawk"), 'epic', 40000, 8],
    ['ruin-guardian', message("msg.ruin_beast"), 'legendary', 65000, 2],
  ]),
  egg('lava-egg', message("msg.lava_egg"), 4800, [
    ['lava-blob', message("msg.magma_blob"), 'common', 18000, 40],
    ['lava-scout', message("msg.magmashell_bug"), 'common', 26500, 30],
    ['lava-friend', message("msg.magma_lizard"), 'rare', 40000, 19],
    ['lava-wing', message("msg.magmawing_bat"), 'epic', 62000, 9],
    ['lava-guardian', message("msg.lava_dragon"), 'legendary', 100000, 2],
  ]),
  egg('fossil-egg', message("msg.fossil_egg"), 6500, [
    ['fossil-blob', message("msg.bone_blob"), 'common', 21000, 43],
    ['fossil-scout', message("msg.bonetail_mouse"), 'common', 31000, 29],
    ['fossil-friend', message("msg.fossil_turtle"), 'rare', 47000, 18],
    ['fossil-wing', message("msg.bonewing_bird"), 'epic', 73000, 8],
    ['fossil-guardian', message("msg.ancient_dragon"), 'legendary', 115000, 2],
  ]),
  egg('gear-egg', message("msg.gear_egg"), 9500, [
    ['gear-blob', message("msg.iron_blob"), 'common', 25000, 40],
    ['gear-scout', message("msg.clockwork_mouse"), 'common', 36500, 32],
    ['gear-friend', message("msg.gear_cat"), 'rare', 56000, 18],
    ['gear-wing', message("msg.mech_hawk"), 'epic', 85000, 8],
    ['gear-guardian', message("msg.steel_bear"), 'legendary', 135000, 2],
  ]),
  egg('star-egg', message("msg.starglow_egg"), 14500, [
    ['star-blob', message("msg.star_blob"), 'common', 29000, 45],
    ['star-scout', message("msg.star_eared_bunny"), 'common', 43000, 27],
    ['star-friend', message("msg.startail_fox"), 'rare', 65000, 18],
    ['star-wing', message("msg.starfeather_whale"), 'epic', 100000, 8],
    ['star-guardian', message("msg.starglow_dragon"), 'legendary', 160000, 2],
  ]),
  egg('core-egg', message("msg.core_egg"), 22000, [
    ['core-blob', message("msg.core_blob"), 'common', 34000, 40],
    ['core-scout', message("msg.glowshell_bug"), 'common', 50000, 30],
    ['core-friend', message("msg.core_lion"), 'rare', 76000, 20],
    ['core-wing', message("msg.radiant_phoenix"), 'epic', 120000, 8],
    ['core-guardian', message("msg.core_dragon"), 'legendary', 190000, 2],
  ]),
 ];
export const PET_CONTENT: PetContent = {
  equipSlots: 3,
  pets: offers.flatMap(entry => entry.pets),
  eggs: offers.map(entry => entry.offer),
};

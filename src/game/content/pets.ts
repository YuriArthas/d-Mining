import type { PetRarity } from '../logic/pets/types.ts';

import { message, type TextRef } from '../i18n/messages.ts';
/** Every egg and the pets in it: identity, names, rarity and where the egg belongs (its world and layer; a
 *  premium egg is a layer's second, pricier egg). Prices, draw weights and bonuses are in economy.json, joined
 *  in petContent.ts. No numbers here: tools/economy/model.mts reads this file. */
export type EggDefinition = Readonly<{
  id: string; name: TextRef; world: 1 | 2 | 3; layer: number; premium: boolean;
  pets: readonly (readonly [id: string, name: TextRef, rarity: PetRarity])[];
}>;
const egg = (id: string, name: TextRef, world: 1 | 2 | 3, layer: number, premium: boolean, pets: EggDefinition['pets']): EggDefinition =>
  Object.freeze({ id, name, world, layer, premium, pets });
export const EGG_DEFINITIONS: readonly EggDefinition[] = Object.freeze([
  egg('meadow-egg', message("msg.meadow_egg"), 1, 0, false, [
    ['moss-slime', message("msg.moss_blob"), 'common'],
    ['quarry-mole', message("msg.quarry_mole"), 'common'],
    ['amber-fox', message("msg.amber_fox"), 'rare'],
    ['crystal-owl', message("msg.crystal_owl"), 'epic'],
    ['moon-dragon', message("msg.moonlight_hatchling"), 'legendary'],
  ]),
  egg('pebble-egg', message("msg.pebble_egg"), 1, 1, false, [
    ['pebble-blob', message("msg.stone_blob"), 'common'],
    ['pebble-scout', message("msg.sand_mouse"), 'common'],
    ['pebble-friend', message("msg.porphyry_bunny"), 'rare'],
    ['pebble-wing', message("msg.bluestone_turtle"), 'epic'],
    ['pebble-guardian', message("msg.boulder_bear"), 'legendary'],
  ]),
  egg('mushroom-egg', message("msg.mushroom_egg"), 1, 2, false, [
    ['mushroom-blob', message("msg.shroom_blob"), 'common'],
    ['mushroom-scout', message("msg.shroom_mouse"), 'common'],
    ['mushroom-friend', message("msg.fuzzcap_bunny"), 'rare'],
    ['mushroom-wing', message("msg.glow_frog"), 'epic'],
    ['mushroom-guardian', message("msg.mushroom_deer"), 'legendary'],
  ]),
  egg('crystal-egg', message("msg.crystal_egg"), 1, 3, false, [
    ['crystal-blob', message("msg.crystal_blob"), 'common'],
    ['crystal-scout', message("msg.crystalshell_bug"), 'common'],
    ['crystal-friend', message("msg.amethyst_fox"), 'rare'],
    ['crystal-wing', message("msg.crystal_crane"), 'epic'],
    ['crystal-guardian', message("msg.crystal_dragon"), 'legendary'],
  ]),
  egg('ruin-egg', message("msg.ruin_egg"), 1, 4, false, [
    ['ruin-blob', message("msg.sand_blob"), 'common'],
    ['ruin-scout', message("msg.stonestripe_mouse"), 'common'],
    ['ruin-friend', message("msg.seal_cat"), 'rare'],
    ['ruin-wing', message("msg.rune_hawk"), 'epic'],
    ['ruin-guardian', message("msg.ruin_beast"), 'legendary'],
  ]),
  egg('frost-egg', message("msg.frost_egg"), 1, 5, false, [
    ['frost-blob', message("msg.snow_blob"), 'common'],
    ['frost-scout', message("msg.frosttail_mouse"), 'common'],
    ['frost-friend', message("msg.fluffy_snow_bunny"), 'rare'],
    ['frost-wing', message("msg.frostwing_hawk"), 'epic'],
    ['frost-guardian', message("msg.frosthorn_bear"), 'legendary'],
  ]),
  egg('fire-egg', message("msg.spark_egg"), 1, 6, false, [
    ['fire-blob', message("msg.fire_blob"), 'common'],
    ['fire-scout', message("msg.coalball_mouse"), 'common'],
    ['fire-friend', message("msg.firetail_fox"), 'rare'],
    ['fire-wing', message("msg.blaze_bird"), 'epic'],
    ['fire-guardian', message("msg.spark_dragon"), 'legendary'],
  ]),
  egg('copper-egg', message("msg.copper_egg"), 2, 0, false, [
    ['copper-blob', message("msg.copper_blob"), 'common'],
    ['copper-scout', message("msg.coppertail_mouse"), 'common'],
    ['copper-friend', message("msg.copper_fox"), 'rare'],
    ['copper-wing', message("msg.brass_bird"), 'epic'],
    ['copper-guardian', message("msg.copperhorn_bull"), 'legendary'],
  ]),
  egg('gear-egg', message("msg.gear_egg"), 2, 1, false, [
    ['gear-blob', message("msg.iron_blob"), 'common'],
    ['gear-scout', message("msg.clockwork_mouse"), 'common'],
    ['gear-friend', message("msg.gear_cat"), 'rare'],
    ['gear-wing', message("msg.mech_hawk"), 'epic'],
    ['gear-guardian', message("msg.steel_bear"), 'legendary'],
  ]),
  egg('silver-egg', message("msg.silver_egg"), 2, 2, false, [
    ['silver-blob', message("msg.silver_blob"), 'common'],
    ['silver-scout', message("msg.silvertail_mouse"), 'common'],
    ['silver-friend', message("msg.silver_eared_bunny"), 'rare'],
    ['silver-wing', message("msg.silverwing_hawk"), 'epic'],
    ['silver-guardian', message("msg.silverhorn_deer"), 'legendary'],
  ]),
  egg('tide-egg', message("msg.tide_egg"), 2, 3, false, [
    ['tide-blob', message("msg.water_blob"), 'common'],
    ['tide-scout', message("msg.bubble_fish"), 'common'],
    ['tide-friend', message("msg.coral_crab"), 'rare'],
    ['tide-wing', message("msg.wave_whale"), 'epic'],
    ['tide-guardian', message("msg.tide_dragon"), 'legendary'],
  ]),
  egg('amber-egg', message("msg.amber_egg"), 2, 4, false, [
    ['amber-blob', message("msg.honey_blob"), 'common'],
    ['amber-scout', message("msg.amber_bee"), 'common'],
    ['amber-friend', message("msg.beeswax_bunny"), 'rare'],
    ['amber-wing', message("msg.goldwing_butterfly"), 'epic'],
    ['amber-guardian', message("msg.amber_lion"), 'legendary'],
  ]),
  egg('lava-egg', message("msg.lava_egg"), 2, 6, false, [
    ['lava-blob', message("msg.magma_blob"), 'common'],
    ['lava-scout', message("msg.magmashell_bug"), 'common'],
    ['lava-friend', message("msg.magma_lizard"), 'rare'],
    ['lava-wing', message("msg.magmawing_bat"), 'epic'],
    ['lava-guardian', message("msg.lava_dragon"), 'legendary'],
  ]),
  egg('star-egg', message("msg.starglow_egg"), 3, 0, false, [
    ['star-blob', message("msg.star_blob"), 'common'],
    ['star-scout', message("msg.star_eared_bunny"), 'common'],
    ['star-friend', message("msg.startail_fox"), 'rare'],
    ['star-wing', message("msg.starfeather_whale"), 'epic'],
    ['star-guardian', message("msg.starglow_dragon"), 'legendary'],
  ]),
  egg('fossil-egg', message("msg.fossil_egg"), 3, 1, false, [
    ['fossil-blob', message("msg.bone_blob"), 'common'],
    ['fossil-scout', message("msg.bonetail_mouse"), 'common'],
    ['fossil-friend', message("msg.fossil_turtle"), 'rare'],
    ['fossil-wing', message("msg.bonewing_bird"), 'epic'],
    ['fossil-guardian', message("msg.ancient_dragon"), 'legendary'],
  ]),
  egg('core-egg', message("msg.core_egg"), 3, 6, false, [
    ['core-blob', message("msg.core_blob"), 'common'],
    ['core-scout', message("msg.glowshell_bug"), 'common'],
    ['core-friend', message("msg.core_lion"), 'rare'],
    ['core-wing', message("msg.radiant_phoenix"), 'epic'],
    ['core-guardian', message("msg.core_dragon"), 'legendary'],
  ]),
  egg('cryo-egg', message("msg.cryo_egg"), 2, 5, false, [
    ['cryo-blob', message("msg.frost_blob"), 'common'],
    ['cryo-scout', message("msg.chill_mouse"), 'common'],
    ['cryo-friend', message("msg.frostshell_bunny"), 'rare'],
    ['cryo-wing', message("msg.ice_crystal_crane"), 'epic'],
    ['cryo-guardian', message("msg.chill_bear"), 'legendary'],
  ]),
  egg('probe-egg', message("msg.probe_egg"), 2, 4, true, [
    ['probe-blob', message("msg.probe_blob"), 'common'],
    ['probe-scout', message("msg.radar_mouse"), 'common'],
    ['probe-friend', message("msg.antenna_cat"), 'rare'],
    ['probe-wing', message("msg.probe_hawk"), 'epic'],
    ['probe-guardian', message("msg.survey_bull"), 'legendary'],
  ]),
  egg('nitro-egg', message("msg.liquid_nitrogen_egg"), 2, 5, true, [
    ['nitro-blob', message("msg.nitro_blob"), 'common'],
    ['nitro-scout', message("msg.frostshell_bug"), 'common'],
    ['nitro-friend', message("msg.icefog_fox"), 'rare'],
    ['nitro-wing', message("msg.glimmer_whale"), 'epic'],
    ['nitro-guardian', message("msg.polar_dragon"), 'legendary'],
  ]),
  egg('fusion-egg', message("msg.fusion_egg"), 2, 6, true, [
    ['fusion-blob', message("msg.energy_blob"), 'common'],
    ['fusion-scout', message("msg.zap_mouse"), 'common'],
    ['fusion-friend', message("msg.fusion_cat"), 'rare'],
    ['fusion-wing', message("msg.plasma_phoenix"), 'epic'],
    ['fusion-guardian', message("msg.reactor_beast"), 'legendary'],
  ]),
  egg('orbit-egg', message("msg.orbit_egg"), 3, 2, false, [
    ['orbit-blob', message("msg.orbit_blob"), 'common'],
    ['orbit-scout', message("msg.orbit_mouse"), 'common'],
    ['orbit-friend', message("msg.cogstar_cat"), 'rare'],
    ['orbit-wing', message("msg.satellite_bird"), 'epic'],
    ['orbit-guardian', message("msg.orbit_bear"), 'legendary'],
  ]),
  egg('geode-egg', message("msg.cluster_egg"), 3, 3, false, [
    ['geode-blob', message("msg.cluster_blob"), 'common'],
    ['geode-scout', message("msg.cluster_bug"), 'common'],
    ['geode-friend', message("msg.shard_bunny"), 'rare'],
    ['geode-wing', message("msg.crystalwing_butterfly"), 'epic'],
    ['geode-guardian', message("msg.cluster_deer"), 'legendary'],
  ]),
  egg('rune-egg', message("msg.starglyph_egg"), 3, 4, false, [
    ['rune-blob', message("msg.glyph_blob"), 'common'],
    ['rune-scout', message("msg.starglyph_mouse"), 'common'],
    ['rune-friend', message("msg.runestar_fox"), 'rare'],
    ['rune-wing', message("msg.starglyph_hawk"), 'epic'],
    ['rune-guardian', message("msg.starglyph_lion"), 'legendary'],
  ]),
  egg('comet-egg', message("msg.comet_ice_egg"), 3, 5, false, [
    ['comet-blob', message("msg.comet_blob"), 'common'],
    ['comet-scout', message("msg.comet_frost_bunny"), 'common'],
    ['comet-friend', message("msg.comettail_fox"), 'rare'],
    ['comet-wing', message("msg.comet_whale"), 'epic'],
    ['comet-guardian', message("msg.comet_ice_dragon"), 'legendary'],
  ]),
  egg('meteor-egg', message("msg.meteor_egg"), 3, 2, true, [
    ['meteor-blob', message("msg.meteor_blob"), 'common'],
    ['meteor-scout', message("msg.flame_mouse"), 'common'],
    ['meteor-friend', message("msg.meteor_bunny"), 'rare'],
    ['meteor-wing', message("msg.meteor_sparrow"), 'epic'],
    ['meteor-guardian', message("msg.meteor_dragon"), 'legendary'],
  ]),
  egg('aurora-egg', message("msg.aurora_egg"), 3, 3, true, [
    ['aurora-blob', message("msg.glow_blob"), 'common'],
    ['aurora-scout', message("msg.aurora_frog"), 'common'],
    ['aurora-friend', message("msg.aurora_fox"), 'rare'],
    ['aurora-wing', message("msg.aurora_butterfly"), 'epic'],
    ['aurora-guardian', message("msg.aurora_deer"), 'legendary'],
  ]),
  egg('nebula-egg', message("msg.nebula_egg"), 3, 4, true, [
    ['nebula-blob', message("msg.cloud_blob"), 'common'],
    ['nebula-scout', message("msg.nebula_fish"), 'common'],
    ['nebula-friend', message("msg.nebula_cat"), 'rare'],
    ['nebula-wing', message("msg.nebula_whale"), 'epic'],
    ['nebula-guardian', message("msg.nebula_beast"), 'legendary'],
  ]),
  egg('galaxy-egg', message("msg.galaxy_egg"), 3, 5, true, [
    ['galaxy-blob', message("msg.river_blob"), 'common'],
    ['galaxy-scout', message("msg.galaxy_crab"), 'common'],
    ['galaxy-friend', message("msg.galaxy_bunny"), 'rare'],
    ['galaxy-wing', message("msg.galaxy_crane"), 'epic'],
    ['galaxy-guardian', message("msg.galaxy_bear"), 'legendary'],
  ]),
  egg('void-egg', message("msg.black_hole_egg"), 3, 6, true, [
    ['void-blob', message("msg.void_blob"), 'common'],
    ['void-scout', message("msg.shadow_bat"), 'common'],
    ['void-friend', message("msg.gravity_cat"), 'rare'],
    ['void-wing', message("msg.black_hole_hawk"), 'epic'],
    ['void-guardian', message("msg.black_hole_dragon"), 'legendary'],
  ]),
]);

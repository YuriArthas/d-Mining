import { pickaxeStats } from '../logic/Pickaxe.ts';
import { ECONOMY, type CurrencyId, type ShopLayer } from './economy.ts';

import { message, type TextRef } from '../i18n/messages.ts';
export type ShopCategory = 'tools' | 'backpacks';
/** How the miner works a tool: a pick's overhead swing, or a drill held out and shaking. */
export type ToolMotion = 'swing' | 'drill';
/** `world` and `shop`: the world it belongs to and the layer of that world whose shop sells it (0 the surface, 2, 4). */
export type ShopItem = Readonly<{ id: string; category: ShopCategory; level: number; model: string; name: TextRef; description: TextRef; price: number; currency: CurrencyId; world: 1 | 2 | 3; shop: ShopLayer; power?: number; speed?: number; capacity?: number; motion?: ToolMotion }>;
type Entry = readonly [name: TextRef, description: TextRef, motion?: ToolMotion];
// World 1 (levels 1-10): joke items from home and kitchen, level 1 a plain pick so a new player knows what it is;
// world 2 (11-20): machines; world 3 (21-30): fantasy and space.
const TOOLS: readonly Entry[] = [
  [message("msg.old_wooden_pick"), message("msg.grandpa_s_old_pick_every_haul_starts_with_it")],
  [message("msg.prickly_cactus"), message("msg.even_ore_is_scared_of_getting_pricked")],
  [message("msg.rock_hard_baguette"), message("msg.a_baguette_left_out_for_three_days_harder_than_rock")],
  [message("msg.flip_over_salted_fish"), message("msg.even_a_salted_fish_can_turn_over_starting_with_mining")],
  [message("msg.sky_high_plunger"), message("msg.nothing_a_plunger_can_t_fix")],
  [message("msg.mega_lollipop"), message("msg.one_lick_one_swing")],
  [message("msg.turbo_egg_beater"), message("msg.at_full_power_it_even_whips_ore_into_cream"), 'drill'],
  [message("msg.melon_mallet"), message("msg.perfectly_ripe_every_swing_a_hit")],
  [message("msg.squeaky_duck_hammer"), message("msg.every_swing_a_little_quack_inside")],
  [message("msg.t_rex_bone"), message("msg.dug_out_of_the_ground_now_digging_it_back_up")],
  [message("msg.big_wrench"), message("msg.can_t_twist_the_ore_open_smash_it")],
  [message("msg.impact_drill"), message("msg.full_throttle_dum_dum_dum_dum_dum"), 'drill'],
  [message("msg.chainsaw"), message("msg.hmmm_the_ore_lines_up_nicely"), 'drill'],
  [message("msg.horseshoe_magnet"), message("msg.ore_flies_over_by_itself_probably")],
  [message("msg.robot_claw"), message("msg.same_as_the_claw_machine_this_time_you_ll_grab_it")],
  [message("msg.neon_street_sign"), message("msg.road_works_ahead_please_detour_ore_excepted")],
  [message("msg.laser_sword"), message("msg.hums_as_it_cuts_ore_like_tofu")],
  [message("msg.rocket_hammer"), message("msg.light_the_fuse_one_swing_all_the_way_down")],
  [message("msg.gear_battleaxe"), message("msg.one_turn_of_the_gears_and_the_vein_breaks")],
  [message("msg.plasma_drill"), message("msg.plasma_heat_melts_rock_on_contact"), 'drill'],
  [message("msg.ice_cream_cone"), message("msg.dig_it_all_before_it_melts")],
  [message("msg.rainbow_pickaxe"), message("msg.after_the_rain_even_the_ore_sparkles")],
  [message("msg.octopus_tentacle"), message("msg.squishy_one_pat_and_ore_sticks_to_it")],
  [message("msg.star_wand"), message("msg.ding_your_ore_turned_into_gold_not_really")],
  [message("msg.lightning_trident"), message("msg.lightning_charged_three_blocks_per_stab")],
  [message("msg.dragon_bone_scythe"), message("msg.an_ancient_dragon_s_fang_still_razor_sharp")],
  [message("msg.unicorn_horn_drill"), message("msg.spins_faster_than_a_drill_and_it_sparkles"), 'drill'],
  [message("msg.pocket_watch_pick"), message("msg.time_warp_ten_swings_a_second")],
  [message("msg.black_hole_hammer"), message("msg.not_even_light_escapes_let_alone_ore")],
  [message("msg.galaxy_pickaxe"), message("msg.grab_the_whole_milky_way_and_dig_through_the_end_of_the_worl")],
];
const BAGS: readonly Entry[] = [
  [message("msg.burlap_sack"), message("msg.tie_it_tight_and_pack_the_first_haul_of_the_journey")],
  [message("msg.cardboard_box"), message("msg.free_delivery_just_not_very_waterproof")],
  [message("msg.picnic_basket"), message("msg.packed_with_ore_tastier_than_a_sandwich")],
  [message("msg.fishbowl"), message("msg.says_the_goldfish_the_ore_is_a_bit_of_a_squeeze")],
  [message("msg.watermelon_backpack"), message("msg.unzip_it_all_ore_no_watermelon")],
  [message("msg.piggy_bank"), message("msg.holds_a_lot_more_than_coins")],
  [message("msg.retro_fridge"), message("msg.kept_chilled_your_ore_stays_fresh")],
  [message("msg.washing_machine"), message("msg.washes_your_ore_sparkling_clean")],
  [message("msg.capsule_machine"), message("msg.one_ore_in_one_ore_out")],
  [message("msg.pirate_chest"), message("msg.so_much_treasure_the_lid_won_t_close")],
  [message("msg.toolbox"), message("msg.screwdrivers_wrenches_and_a_pile_of_ore")],
  [message("msg.oil_drum"), message("msg.don_t_ask_what_the_green_stuff_is")],
  [message("msg.jetpack"), message("msg.fly_with_a_load_of_ore_not_yet")],
  [message("msg.microwave"), message("msg.ding_your_ore_is_nice_and_warm")],
  [message("msg.battery_pack"), message("msg.charge_is_cargo_sell_when_it_s_full")],
  [message("msg.robot_backpack"), message("msg.it_remembers_every_block_of_ore_for_you")],
  [message("msg.satellite_dish"), message("msg.full_signal_every_vein_in_sight")],
  [message("msg.mini_container"), message("msg.tiny_but_holds_a_shipload_of_ore")],
  [message("msg.reactor_pod"), message("msg.glows_green_brighter_the_fuller_it_gets")],
  [message("msg.rocket"), message("msg.loaded_with_ore_ready_for_launch")],
  [message("msg.cloudlet"), message("msg.light_as_air_with_the_odd_drizzle")],
  [message("msg.jack_o_lantern"), message("msg.grins_brightest_underground")],
  [message("msg.beehive"), message("msg.the_bees_keep_watch_no_ore_goes_missing")],
  [message("msg.jellyfish"), message("msg.ore_floats_around_inside")],
  [message("msg.ringed_planet"), message("msg.carries_a_whole_planet_to_the_mine")],
  [message("msg.dragon_egg"), message("msg.something_inside_seems_to_be_peeking_out")],
  [message("msg.spellbook"), message("msg.turn_a_page_carry_one_more_layer")],
  [message("msg.hourglass"), message("msg.more_sand_more_loot")],
  [message("msg.mini_portal"), message("msg.ore_teleports_straight_in")],
  [message("msg.black_hole_jar"), message("msg.holds_as_much_as_you_like_in_theory")],
];
export const equipmentModel = (kind: ShopCategory, level: number) => `${kind === 'tools' ? 'Tool' : 'Bag'}${String(Math.min(30,level)).padStart(2,'0')}`;
export const toolMotion = (level: number): ToolMotion => TOOLS[Math.min(30, level) - 1][2] ?? 'swing';
/** The 30 pickaxes; price, currency, damage and speed from economy.json. */
export function shopTools(): readonly ShopItem[] {
  return ECONOMY.tools.map((tool,i) => {
    const level=i+1,stats=pickaxeStats(level),[name,description]=TOOLS[i];
    return Object.freeze({id:`tool-${level}`,category:'tools' as const,level,model:equipmentModel('tools',level),name,description,
      price:tool.price,currency:tool.currency,world:Math.ceil(level/10) as 1|2|3,shop:tool.shop,power:stats.power,speed:stats.speed,motion:toolMotion(level)});
  });
}
/** The 30 backpacks, ten per world, counted in blocks (economy.json). */
export function shopBackpacks(): readonly ShopItem[] {
  return ECONOMY.bags.map((bag,i)=>{
    const [name,description]=BAGS[i];
    return Object.freeze({id:i===0?'starter-bag':`journey-bag-${i+1}`,category:'backpacks' as const,
      level:i+1,model:equipmentModel('backpacks',i+1),name,description,capacity:bag.capacity,price:bag.price,currency:bag.currency,world:Math.ceil((i+1)/10) as 1|2|3,shop:bag.shop});
  });
}

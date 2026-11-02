// Offline: the 老矿井 rest hall on the shared cave shell (caveKit.ts): a warm timber mine. Two hoist headframes stand
// in the north corners, timber support sets line the walls, ore carts wait on rail track along both sides of the
// floor ring, and a cart depot with a glowing ore pile fills the south-east (this layer has no shop). Props from
// build_old_mine.py, with their colliders.
import { caveKit, glow, matte, type GetProp } from './caveKit.ts';
import { OLD_MINE_HALL as HALL } from '../../../src/game/content/underground/oldMineHall.ts';

export function buildHall(getProp: GetProp) {
  const L = HALL.layout;
  const kit = caveKit(HALL, 40001, {
    rock: ['#86684e', '#b08a64'], upper: ['#957358', '#654c38'], ceiling: ['#56422f', '#7a5d44'],
    stalactite: ['#735842', '#a58462'], joint: '#4a3828', stones: ['#9a8670', '#a5917a', '#8c7a66', '#988a78'], curb: '#8e7a66',
  }, [
    ...L.hoists.map(h => ({ x: h.at[0], z: h.at[1], radius: 4.8 })),
    ...L.timberSets.map(t => ({ x: t.at[0], z: t.at[1], radius: 3 })),
    { x: L.depot[0], z: L.depot[1], radius: 3.6 },
  ]);
  const { r, place } = kit;
  kit.useProps(getProp);
  const amber = glow('Cave glow amber', '#ffb45a', 1.2), dirt = matte('Cave dirt');

  kit.walls();
  kit.ceiling(55, [amber], .12);
  // Boardwalk on packed earth: planks pointing at the walls, a few missing.
  kit.floor({ kind: 'planks', width: .62, gap: .07, missing: .06, height: [.04, .07], stones: ['#a07446', '#ac7e4e', '#946a40', '#b48a58'] });
  kit.patches(kit.wallSpots(18, [[-12.8, -1, 2.4], [12.8, 3, 2.4], [L.depot[0], L.depot[1], 3]]), dirt, '#7c6448', 'Cave dirt', [amber], 1, 1.4);
  kit.pitRim();

  // HOISTS: the landmarks, turned toward the pit.
  for (const { at, yaw } of L.hoists) place('Hoist', [at[0], 0, at[1]], yaw);
  // TIMBER SETS against the walls.
  for (const { at, yaw } of L.timberSets) place('Timber_Set', [at[0], 0, at[1]], yaw);
  // RAIL TRACK along both sides of the floor ring (flat, walked over), a buffer stop at each end, carts on it.
  for (const { x, from, to } of L.tracks) {
    for (let z = from + 2; z <= to - 2 + 1e-6; z += 4) place('Rail_Track', [x, 0, z], Math.PI / 2);
    for (const [z, yaw] of [[from - .2, -Math.PI / 2], [to + .2, Math.PI / 2]] as const) place('Rail_Buffer', [x, 0, z], yaw);
  }
  for (const [x, z] of L.carts) place('Ore_Cart', [x, 0, z], Math.PI / 2);
  // CART DEPOT in the south-east: the ore pile, crates, barrels and sacks.
  place('Ore_Pile', [L.depot[0], 0, L.depot[1]], .4, 1.3);
  for (const { name, at, yaw } of L.depotProps) place(name, [at[0], 0, at[1]], yaw);

  kit.services(L.lanterns);
  kit.wallFoot(30, () => {
    const k = r();
    return k < .3 ? { name: 'Ore_Rock', scale: () => .9 + r() * .6 }
      : k < .55 ? { name: 'Barrel_Group', scale: () => .9 + r() * .2 }
      : k < .8 ? { name: 'Crate_Stack', scale: () => .85 + r() * .2 }
      : { name: 'Sack_Pile', scale: () => .9 + r() * .3 };
  });
  return { group: kit.group, solids: kit.solids, lights: HALL.lights };
}

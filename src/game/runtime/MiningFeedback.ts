import { Color } from 'three';
import type { GameSession, SessionFeedback } from '../application/GameSession.ts';
import { itemDefinition } from '../application/items.ts';
import { QUIET_SCENE, gameAudio, type GameAudio } from '../audio/GameAudio.ts';
import type { HitMaterial } from '../audio/sfx.ts';
import { Soundscape, type PlaceSound } from '../audio/soundscape.ts';
import { layerAtDepth, type Layer } from '../content/layers.ts';
import { resourceByKind } from '../content/resources.ts';
import { PINEWIND_CREEK } from '../content/pinewind/hubLayout.ts';
import { HitEffects, type BlockColors } from '../presentation/HitEffects.ts';
import { WaterSplash } from '../presentation/WaterSplash.ts';
import { OreSparkles, type SparkleOre } from '../presentation/OreSparkles.ts';
import { MINERAL_TIME } from '../terrain/mineralMaterial.ts';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';
import { footSurface } from './footSurface.ts';

type FeedbackStrike = Readonly<{ cell: Coord; kind: number; breaking: boolean }>;
/** `contact` is the pick tip's world position on the frame the swing reaches the block; `step` is a
 *  foot planting (with its strength). */
type AvatarMoments = Readonly<{ contact: readonly number[] | null; jump: boolean; land: number | null; step?: number | null }>;
type Ports = Readonly<{
  /** Current block kind, or 0/null once mined. */
  cell(cell: Coord): number | null;
  /** Strata of the world containing this cell. */
  layers(cell: Coord): readonly Layer[];
  /** Whether these feet are on world 1's surface hub (its ground plan sets the footstep surface). */
  hub?(feet: readonly number[]): boolean;
}>;

const SAND = new Color('#d6bf92');
const STONE = new Color('#8d948c');
const GLASSY = new Set(['gem']);
const SPARKLE_WHITE = new Color('#ffffff');
const sparkleLooks = new Map<number, SparkleOre>();
/** Which blocks give off sparkles: gems often, metals sometimes, veins rarely, rock never. Dark ores glint lighter. */
function sparkleOre(kind: number): SparkleOre {
  if (sparkleLooks.has(kind)) return sparkleLooks.get(kind)!;
  const found = resource(kind);
  let look: SparkleOre = null;
  if (found && !found.base) {
    const color = new Color(found.color), light = color.r * .3 + color.g * .59 + color.b * .11;
    if (light < .35) color.lerp(SPARKLE_WHITE, .45);
    look = { color, strength: found.pattern === 'gem' ? 1 : found.pattern === 'metal' ? .6 : light < .2 ? 0 : .25 };
  }
  sparkleLooks.set(kind, look); return look;
}
// Feedback must never break a frame: unknown kinds fall back to plain rock.
const resource = (kind: number) => { try { return resourceByKind(kind); } catch { return null; } };

export function hitMaterial(kind: number): HitMaterial {
  const found = resource(kind);
  if (!found || found.base) return 'rock';
  return GLASSY.has(found.pattern) ? 'gem' : 'ore';
}
/** Pickup sound by the ore's class within its layer (prices grow exponentially between layers):
 *  host rock 0, the layer's common ore 1, its rare gem 2. */
export function pickupTier(itemId: string) {
  let found;
  try { found = itemDefinition(itemId); } catch { return 0; }
  return found.base ? 0 : GLASSY.has(found.pattern) ? 2 : 1;
}

/** Turns game moments into sound and short effects. The final blow bursts at once (the block is
 *  queued for removal at that moment); other hits sound when the swing actually reaches the block.
 *  It also tells the audio where the player is (music and ambience) and what they walk on. */
export class MiningFeedback {
  readonly effects = new HitEffects();
  readonly splash = new WaterSplash();
  readonly sparkles: OreSparkles;
  private wading = false;
  private readonly soundscape = new Soundscape();
  private theme = 'meadow_mine';
  private pending: FeedbackStrike | null = null;
  private readonly ports: Ports;
  private readonly audio: GameAudio;
  private readonly detach: (() => void)[];

  constructor(session: Pick<GameSession, 'onFeedback' | 'onOreCollected'>, ports: Ports, audio: GameAudio = gameAudio) {
    this.ports = ports; this.audio = audio;
    this.sparkles = new OreSparkles(c => ports.cell(c), sparkleOre);
    this.detach = [session.onFeedback(this.onSession), session.onOreCollected(this.onPickup)];
  }

  /** Call once per frame after the avatar update, with that frame's accepted hit (if any). */
  update(delta: number, strike: FeedbackStrike | null, moments: AvatarMoments, feet: readonly number[]) {
    const chest = [feet[0], feet[1] + 1.1, feet[2]];
    if (moments.contact && this.pending) {
      const { cell, kind } = this.pending;
      this.pending = null;
      if (this.ports.cell(cell)) {
        this.effects.hit(cell, chest, this.colors(cell, kind), n => !this.ports.cell([cell[0] + n.x, cell[1] + n.y, cell[2] + n.z]), moments.contact);
        this.audio.play({ type: 'hit', material: hitMaterial(kind) });
      }
    }
    if (strike) {
      if (strike.breaking) {
        this.pending = null;
        this.effects.burst(strike.cell, this.colors(strike.cell, strike.kind));
        this.audio.play({ type: 'break', material: hitMaterial(strike.kind) });
      } else this.pending = strike;
    }
    // Wading in the creek: every step, a landing and the moment the feet go under the surface splash.
    const wading = feet[1] < PINEWIND_CREEK.water + .05 && this.surface(feet) === 'water';
    if (moments.step != null) {
      const surface = wading ? 'water' : this.surface(feet);
      this.audio.play({ type: 'step', surface, strength: moments.step });
      if (wading) this.splash.splash(feet[0], PINEWIND_CREEK.water, feet[2], .3 + moments.step * .2);
    }
    if (moments.jump) this.audio.play({ type: 'jump' });
    if (moments.land !== null) {
      this.audio.play({ type: 'land', strength: moments.land });
      if (wading) this.splash.splash(feet[0], PINEWIND_CREEK.water, feet[2], .55 + moments.land * .6);
      else if (moments.land > 0.45) this.effects.dust(feet, this.ground(feet));
    } else if (wading && !this.wading) this.splash.splash(feet[0], PINEWIND_CREEK.water, feet[2], .6);
    this.wading = wading;
    this.effects.update(delta);
    this.splash.update(delta);
    this.sparkles.update(delta, chest);
    MINERAL_TIME.value = (MINERAL_TIME.value + delta) % 3600;
  }

  travel() { this.pending = null; this.sparkles.clear(); this.audio.play({ type: 'travel' }); }

  /** Call every frame with the place around the feet. */
  place(place: PlaceSound) {
    this.theme = place.theme;
    this.audio.setScene(this.soundscape.scene(place));
  }

  surface(feet: readonly number[]) {
    return footSurface(feet, { cell: c => this.ports.cell(c), theme: () => this.theme, hub: f => this.ports.hub?.(f) ?? false });
  }

  dispose() { for (const detach of this.detach) detach(); this.effects.dispose(); this.splash.dispose(); this.sparkles.dispose(); this.audio.setScene(QUIET_SCENE); }

  private readonly onSession = (event: SessionFeedback) => {
    switch (event.type) {
      case 'sold': this.audio.play({ type: 'sell' }); break;
      case 'purchased': this.audio.play({ type: 'purchase' }); break;
      case 'reward': this.audio.play({ type: 'reward' }); break;
      case 'hatched': this.audio.play({ type: 'hatch', tier: event.tier, auto: event.auto }); break;
      case 'unlocked': case 'reborn': this.audio.play({ type: 'unlock' }); break;
      case 'denied': this.audio.play({ type: 'denied' }); break;
    }
  };

  private readonly onPickup = (batch: readonly { itemId: string }[]) => {
    this.audio.play({ type: 'pickup', tier: Math.max(0, ...batch.map(({ itemId }) => pickupTier(itemId))) });
  };

  /** Host rock of the block's stratum, plus the ore colour for ore blocks. */
  private colors(cell: Coord, kind: number): BlockColors {
    const found = resource(kind);
    if (!found) return { host: STONE, ore: null };
    if (found.base) return { host: new Color(found.color), ore: null };
    const host = resource(layerAtDepth(-(cell[1] + 1) * CELL, this.ports.layers(cell)).base);
    return { host: host ? new Color(host.color) : STONE, ore: new Color(found.color) };
  }

  private ground(feet: readonly number[]) {
    const below = this.ports.cell([Math.floor(feet[0] / CELL), Math.floor((feet[1] - 0.1) / CELL), Math.floor(feet[2] / CELL)]);
    const found = below && below !== 7 ? resource(below) : null;
    return found ? new Color(found.color) : SAND;
  }
}

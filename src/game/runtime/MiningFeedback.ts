import { Color } from 'three';
import type { GameSession, SessionFeedback } from '../application/GameSession.ts';
import { itemDefinition } from '../application/items.ts';
import { gameAudio, type GameAudio } from '../audio/GameAudio.ts';
import type { HitMaterial } from '../audio/sfx.ts';
import { layerAtDepth, type Layer } from '../content/layers.ts';
import { resourceByKind } from '../content/resources.ts';
import { HitEffects, type BlockColors } from '../presentation/HitEffects.ts';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';

export type FeedbackStrike = Readonly<{ cell: Coord; kind: number; breaking: boolean }>;
/** `contact` is the pick tip's world position on the frame the swing reaches the block. */
export type AvatarMoments = Readonly<{ contact: readonly number[] | null; jump: boolean; land: number | null }>;
type Ports = Readonly<{
  /** Current block kind, or 0/null once mined. */
  cell(cell: Coord): number | null;
  /** Strata of the world containing this cell. */
  layers(cell: Coord): readonly Layer[];
}>;

const SAND = new Color('#d6bf92');
const STONE = new Color('#8d948c');
const GLASSY = new Set(['crystal', 'gem', 'star', 'ice', 'amber']);
// Feedback must never break a frame: unknown kinds fall back to plain rock.
const resource = (kind: number) => { try { return resourceByKind(kind); } catch { return null; } };

export function hitMaterial(kind: number): HitMaterial {
  const found = resource(kind);
  if (!found || found.base) return found?.pattern === 'soil' ? 'soil' : 'rock';
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
 *  queued for removal at that moment); other hits sound when the swing actually reaches the block. */
export class MiningFeedback {
  readonly effects = new HitEffects();
  private pending: FeedbackStrike | null = null;
  private readonly ports: Ports;
  private readonly audio: GameAudio;
  private readonly detach: (() => void)[];

  constructor(session: Pick<GameSession, 'onFeedback' | 'onOreCollected'>, ports: Ports, audio: GameAudio = gameAudio) {
    this.ports = ports; this.audio = audio;
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
    if (moments.jump) this.audio.play({ type: 'jump' });
    if (moments.land !== null) {
      this.audio.play({ type: 'land', strength: moments.land });
      if (moments.land > 0.45) this.effects.dust(feet, this.ground(feet));
    }
    this.effects.update(delta);
  }

  travel() { this.pending = null; this.audio.play({ type: 'travel' }); }

  dispose() { for (const detach of this.detach) detach(); this.effects.dispose(); }

  private readonly onSession = (event: SessionFeedback) => {
    switch (event.type) {
      case 'sold': this.audio.play({ type: 'sell' }); break;
      case 'purchased': this.audio.play({ type: 'purchase' }); break;
      case 'reward': this.audio.play({ type: 'reward' }); break;
      case 'hatched': this.audio.play({ type: 'hatch', tier: event.tier, auto: event.auto }); break;
      case 'unlocked': this.audio.play({ type: 'unlock' }); break;
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

import { Vector3, type Camera } from 'three';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';
import { formatNumber } from './formatNumber.ts';
import { SALE_FLIGHT, saleCoinCount, saleLanding } from './saleFlight.ts';

import { tr } from '../i18n/i18n.ts';
/** What the session says about the block under the pick (GameSession snapshot `target`). */
export type OverlayTarget = Readonly<{ key: string; name: string; hp: number; maximum: number; price: number; requiredLevel: number; locked: boolean }>;
/** A swing that reached its block this frame (MiningFeedback): the damage it did, and whether it broke the block. */
export type LandedHit = Readonly<{ cell: Coord; damage: number; final: boolean }>;
type Refusal = 'locked' | 'full';
/** SVG markup for the icons the overlay draws (the kit's icons, without React). */
export type OverlayIcons = Readonly<{ currency(): string; lock: string; bag: string; ore(color: string): string }>;

const PLATE_SECONDS = 1.5, MAX_NUMBERS = 6, NUMBER_MS = 700, FLY_MS = 480, FLY_GAP_MS = 160, TOP_CLEAR = 72, EDGE = 8;
const keyOf = (cell: Coord) => cell.join(',');
const SPREAD = [-26, 20, -8, 30, -20, 8];
/** Stretches the overlay's timings (1 = normal) so screenshots on a slow renderer can catch them (debug only). */
let timeScale = 1;
export const setMiningOverlayTimeScale = (scale: number) => { timeScale = scale; };
/** The same stretch for other UI flourishes timed in script (the hatch). */
export const uiTimeScale = () => timeScale;

/** The mining layer of the UI, drawn over the scene without React (docs/draft-ui-v2.md, U3):
 *  - a plate over the block being mined: name, sell price and a health bar whose lost part first turns white and
 *    then shrinks; it appears with the first swing at a block, follows it on screen and fades 1.5 s after the last;
 *    a block the pickaxe cannot dig or a full bag turn it into that one line instead;
 *  - a damage number from every swing that lands, the breaking one larger;
 *  - the ore icon flying from the broken block to the bag, which bounces as it lands, with a short "+1 铜矿" by it;
 *  - a sale: "+1234" over the miner's head while coins burst out of the miner and fly into the money counter, which
 *    jumps as each one lands (saleFlight.ts keeps their timing with the counter and the sound).
 *  Every frame only moves elements that already exist (no layout of new nodes per frame). */
export class MiningOverlay {
  private readonly root: HTMLElement;
  private readonly plate: HTMLElement;
  private readonly plateName: HTMLElement;
  private readonly platePrice: HTMLElement;
  private readonly lag: HTMLElement;
  private readonly hp: HTMLElement;
  private readonly note: HTMLElement;
  private readonly numbers: HTMLElement[] = [];
  private readonly chip: HTMLElement;
  private readonly gain: HTMLElement;
  /** A sale waiting for the next frame, when the camera has caught up with a trip to the sell ring. */
  private sale: number | null = null;
  private nextNumber = 0;
  private readonly point = new Vector3();
  private readonly view = new Vector3();
  /** The block the plate is about, while it is engaged; its last screen position; what the bar shows. */
  private cell: Coord | null = null;
  private engagedAt = -Infinity;
  private refusal: Refusal | null = null;
  private shownHp = 0;
  private shownMax = 1;
  private broken = false;
  private lastBreak: { x: number; y: number } | null = null;
  private lastFly = -Infinity;
  private chipTimer: ReturnType<typeof setTimeout> | undefined;
  /** The last block the session described: a tap selects a block only on the frame it presses, while the swing
   *  lands a few frames later, so the plate reads the block's name, price and health from here. */
  private seen: OverlayTarget | null = null;
  /** What the plate's elements show now, so a frame writes only what changed. */
  private readonly shown = new Map<HTMLElement | string, string>();
  private readonly icons: OverlayIcons;
  constructor(root: HTMLElement, icons: OverlayIcons) {
    this.root = root; this.icons = icons;
    root.innerHTML = '';
    this.plate = el('div', 'mine-plate');
    this.plate.innerHTML = '<div class="mine-plate-head"><b></b><span class="mine-plate-price"></span></div><div class="mine-plate-bar"><i class="mine-plate-lag"></i><i class="mine-plate-hp"></i></div><div class="mine-plate-note"></div>';
    this.plateName = this.plate.querySelector('b')!;
    this.platePrice = this.plate.querySelector('.mine-plate-price')!;
    this.lag = this.plate.querySelector('.mine-plate-lag')!;
    this.hp = this.plate.querySelector('.mine-plate-hp')!;
    this.note = this.plate.querySelector('.mine-plate-note')!;
    this.plate.setAttribute('role', 'status');
    root.append(this.plate);
    for (let i = 0; i < MAX_NUMBERS; i++) { const n = el('span', 'mine-dmg ui-num'); root.append(n); this.numbers.push(n); }
    this.chip = el('div', 'mine-chip'); root.append(this.chip);
    this.gain = el('div', 'sale-gain'); root.append(this.gain);
  }

  /** A sale went through for `coins`: its coins burst out of the miner on the next frame. */
  sold(coins: number) { this.sale = coins; }

  /** The player swung at a block the pickaxe cannot dig, or with a full bag: the plate says so over that block. */
  refuse(reason: Refusal, cell: Coord | null, now: number) {
    if (!cell) return;
    this.engage(cell, now);
    this.refusal = reason;
    this.plate.classList.remove('mine-shake'); void this.plate.offsetWidth; this.plate.classList.add('mine-shake');
  }

  /** Ore reached the bag (or the material store): fly its icon from the broken block to the bag pill. */
  collected(items: readonly { name: string; color: string; count: number; note: string | null }[], now: number) {
    if (!items.length) return;
    const bag = document.querySelector<HTMLElement>('.hud-bag .ui-pill-icon');
    const target = bag?.getBoundingClientRect(), box = this.root.getBoundingClientRect();
    const first = items[0];
    if (target && this.lastBreak && now * 1000 - this.lastFly > FLY_GAP_MS * timeScale) {
      this.lastFly = now * 1000;
      const fly = el('div', 'mine-fly'); fly.innerHTML = this.icons.ore(first.color);
      this.root.append(fly);
      const from = this.lastBreak, to = { x: target.left - box.left + target.width / 2, y: target.top - box.top + target.height / 2 };
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
      const at = (p: { x: number; y: number }, s: number) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${s})`;
      const run = fly.animate([{ transform: at(from, 1), opacity: 1 }, { transform: at(mid, 1.25), opacity: 1, offset: .45 }, { transform: at(to, .7), opacity: .9 }],
        { duration: FLY_MS * timeScale, easing: 'cubic-bezier(.4, 0, .6, 1)' });
      run.onfinish = () => { fly.remove(); bounce(bag!); };
    } else if (bag) bounce(bag);
    // Two kinds at most; a wide break names the first two and says there was more.
    this.chip.textContent = items.slice(0, 2).map(i => `+${i.count} ${i.name}${i.note ? ` · ${i.note}` : ''}`).join('  ') + (items.length > 2 ? tr(' 等') : '');
    if (target) { this.chip.style.left = `${target.left - box.left}px`; this.chip.style.top = `${target.bottom - box.top + 6}px`; }
    this.chip.classList.remove('mine-chip-in'); void this.chip.offsetWidth; this.chip.classList.add('mine-chip-in');
    clearTimeout(this.chipTimer);
    this.chipTimer = setTimeout(() => this.chip.classList.remove('mine-chip-in'), 1400 * timeScale);
  }

  /** Call every frame after the swing feedback, with the block under the pick, the session's view of it and the
   *  swings that landed this frame. `now` is in seconds. */
  update(camera: Camera, now: number, selected: Coord | null, target: OverlayTarget | null, landed: readonly LandedHit[], feet: readonly number[] | null = null) {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    // Hidden under a panel (selling from the bag): the money is there when it closes, without the flourish.
    if (this.sale !== null) { if (width) this.coinBurst(camera, this.sale, feet, width, height); this.sale = null; }
    if (target) this.seen = target;
    for (const hit of landed) {
      this.engage(hit.cell, now);
      this.refusal = null;
      const at = this.project(camera, hit.cell, .5, width, height);
      // The bar moves when the swing lands, not when the button is pressed.
      if (this.seen?.key === keyOf(hit.cell)) { this.shownHp = this.seen.hp; this.shownMax = this.seen.maximum; }
      if (hit.final) { this.shownHp = 0; this.broken = true; this.lastBreak = at; }
      if (at) this.number(hit.damage, at, hit.final);
    }
    const engaged = this.cell && now - this.engagedAt < (this.broken ? .3 : PLATE_SECONDS) * timeScale
      && (this.broken || !selected || keyOf(selected) === keyOf(this.cell));
    if (!engaged || !this.cell) { this.hide(); return; }
    const at = this.project(camera, this.cell, 1.05, width, height);
    if (!at) { this.hide(); return; }
    const info = this.seen?.key === keyOf(this.cell) ? this.seen : null;
    if (info) {
      this.write(this.plateName, info.name, 'text');
      this.write(this.platePrice, `${this.icons.currency()}<i class="ui-num">${formatNumber(info.price)}</i>`);
    }
    const locked = this.refusal === 'locked' || !!info?.locked;
    const state = this.broken ? 'broken' : locked ? 'locked' : this.refusal === 'full' ? 'full' : 'hit';
    if (this.shown.get('state') !== state) { this.shown.set('state', state); this.plate.dataset.state = state; }
    this.write(this.note, state === 'locked' ? `${this.icons.lock}<span>${tr('需要 Lv.{level} 镐子', { level: info?.requiredLevel ?? '' })}</span>`
      : state === 'full' ? `${this.icons.bag}<span>${tr('背包满了，去出售')}</span>` : '');
    const ratio = `${(Math.max(0, Math.min(1, this.shownHp / Math.max(1, this.shownMax))) * 100).toFixed(1)}%`;
    if (this.shown.get('ratio') !== ratio) { this.shown.set('ratio', ratio); this.hp.style.width = ratio; this.lag.style.width = ratio; }
    if (!this.size || this.shown.get('size') !== `${state}|${this.plateName.textContent}`) {
      this.shown.set('size', `${state}|${this.plateName.textContent}`); this.size = { w: this.plate.offsetWidth || 130, h: this.plate.offsetHeight || 44 };
    }
    const { w, h } = this.size;
    const x = Math.min(width - EDGE - w / 2, Math.max(EDGE + w / 2, at.x));
    let y = Math.max(TOP_CLEAR + h, Math.min(height - EDGE, at.y - 10));
    // Looking down on the miner, "over the block" can be over the miner's head: then the plate goes under the block.
    const miner = feet && this.figure(camera, feet, width, height);
    if (miner && x + w / 2 > miner.x0 && x - w / 2 < miner.x1 && y > miner.y0 && y - h < miner.y1) {
      const under = this.project(camera, this.cell, -.05, width, height);
      if (under) y = Math.min(height - EDGE, Math.max(under.y, miner.y1) + 8 + h);
    }
    this.plate.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - h)}px)`;
    if (!this.plate.classList.contains('mine-plate-on')) this.plate.classList.add('mine-plate-on');
  }

  dispose() { clearTimeout(this.chipTimer); this.root.innerHTML = ''; }

  private size: { w: number; h: number } | null = null;
  private write(element: HTMLElement, value: string, as: 'html' | 'text' = 'html') {
    if (this.shown.get(element) === value) return;
    this.shown.set(element, value);
    if (as === 'text') element.textContent = value; else element.innerHTML = value;
  }

  private engage(cell: Coord, now: number) {
    if (!this.cell || keyOf(this.cell) !== keyOf(cell) || this.broken) {
      this.cell = cell; this.broken = false; this.refusal = null;
      const known = this.seen?.key === keyOf(cell) ? this.seen : null;
      this.shownHp = known?.hp ?? 0; this.shownMax = known?.maximum ?? 1;
    }
    this.engagedAt = now;
  }

  private hide() {
    if (this.plate.classList.contains('mine-plate-on')) this.plate.classList.remove('mine-plate-on');
    if (this.cell && this.broken) { this.cell = null; this.broken = false; }
  }

  /** Screen position (px in the overlay) of a point `up` cells above the bottom of a cell's centre column, or null
   *  when it is behind the camera or off screen. */
  private project(camera: Camera, cell: Coord, up: number, width: number, height: number) {
    this.point.set((cell[0] + .5) * CELL, (cell[1] + up) * CELL, (cell[2] + .5) * CELL);
    this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);
    if (this.view.z >= 0) return null;
    this.point.project(camera);
    if (Math.abs(this.point.x) > 1.05 || Math.abs(this.point.y) > 1.05) return null;
    return { x: (this.point.x + 1) / 2 * width, y: (1 - this.point.y) / 2 * height };
  }

  /** Screen position (px in the overlay) of a point `up` metres over the feet, or null when it is behind the camera. */
  private overFeet(camera: Camera, feet: readonly number[], up: number, width: number, height: number) {
    this.point.set(feet[0], feet[1] + up, feet[2]);
    this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);
    if (this.view.z >= 0) return null;
    this.point.project(camera);
    return { x: (this.point.x + 1) / 2 * width, y: (1 - this.point.y) / 2 * height };
  }

  /** The miner's box on screen (feet to head), or null when off screen. */
  private figure(camera: Camera, feet: readonly number[], width: number, height: number) {
    const at = (up: number) => this.overFeet(camera, feet, up, width, height);
    const foot = at(0), head = at(1.9);
    if (!foot || !head) return null;
    const half = Math.max(24, Math.abs(foot.y - head.y) * .35);
    return { x0: head.x - half, x1: head.x + half, y0: Math.min(head.y, foot.y) - 6, y1: Math.max(head.y, foot.y) };
  }

  /** "+1234" rises over the miner's head; the coins fan out of the chest, hang a moment and fly one after another
   *  along a curve into the money counter's icon, which jumps as each lands; the last makes the number jump too.
   *  Off screen (or no miner), from the middle of the screen. */
  private coinBurst(camera: Camera, coins: number, feet: readonly number[] | null, width: number, height: number) {
    const onScreen = (p: { x: number; y: number } | null) => p && p.x > 0 && p.x < width && p.y > 0 && p.y < height ? p : null;
    const chest = onScreen(feet && this.overFeet(camera, feet, 1.1, width, height)) ?? { x: width / 2, y: height / 2 };
    const head = onScreen(feet && this.overFeet(camera, feet, 2.3, width, height)) ?? { x: chest.x, y: chest.y - 50 };
    const s = timeScale, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.gain.innerHTML = `${this.icons.currency()}<b class="ui-num">+${formatNumber(coins)}</b>`;
    this.gain.style.left = `${head.x}px`; this.gain.style.top = `${Math.max(TOP_CLEAR + 20, head.y)}px`;
    this.gain.getAnimations().forEach(a => a.cancel());
    const rise = (y: number, scale: number) => `translate(-50%, calc(-50% - ${y}px)) scale(${scale})`;
    this.gain.animate(still ? [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }] : [
      { transform: rise(0, .4), opacity: 0 }, { transform: rise(26, 1.25), opacity: 1, offset: .12, easing: 'ease-out' },
      { transform: rise(32, 1), opacity: 1, offset: .22 }, { transform: rise(44, 1), opacity: 1, offset: .8 }, { transform: rise(60, 1), opacity: 0 },
    ], { duration: (SALE_FLIGHT.first + SALE_FLIGHT.stream) * s, fill: 'forwards' });
    const counter = document.querySelector<HTMLElement>('.hud-coins .ui-pill-icon'), value = document.querySelector<HTMLElement>('.hud-coins .ui-pill-value');
    const target = counter?.getBoundingClientRect(), box = this.root.getBoundingClientRect();
    if (still || !counter || !target?.width) return;
    const to = { x: target.left - box.left + target.width / 2, y: target.top - box.top + target.height / 2 };
    const at = (p: { x: number; y: number }, scale: number) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${scale})`;
    const count = saleCoinCount(coins), coin = this.icons.currency();
    for (let i = 0; i < count; i++) {
      // A fan opening upward, every coin its own distance; it then curves out its own side on the way to the counter.
      const angle = -Math.PI / 2 + ((i + .5) / count - .5) * Math.PI * 1.5 + (Math.random() - .5) * .3, reach = 48 + Math.random() * 46;
      const out = { x: chest.x + Math.cos(angle) * reach, y: chest.y + Math.sin(angle) * reach * .8 };
      const held = { x: out.x, y: out.y - 6 }, bend = { x: (held.x + to.x) / 2 + (out.x - chest.x) * .9, y: Math.min(held.y, to.y) - 40 };
      const land = saleLanding(i, count), leave = land - SALE_FLIGHT.flight;
      const frames: Keyframe[] = [
        { transform: at(chest, .3), opacity: 0, offset: 0, easing: 'cubic-bezier(.15, .8, .3, 1.15)' },
        { transform: at(out, 1.05), opacity: 1, offset: SALE_FLIGHT.burst / land },
        { transform: at(held, 1), opacity: 1, offset: leave / land },
      ];
      // The flight speeds up into the counter: points of the curve at eased steps, joined straight.
      for (let k = 1; k <= 6; k++) {
        const u = k / 6, t = u * u, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
        frames.push({ transform: at({ x: a * held.x + b * bend.x + c * to.x, y: a * held.y + b * bend.y + c * to.y }, 1 - .35 * t), opacity: 1, offset: (leave + u * SALE_FLIGHT.flight) / land });
      }
      const fly = el('div', 'sale-coin'); fly.innerHTML = coin;
      fly.style.setProperty('--spin', `${(.35 + Math.random() * .2) * s}s`);
      this.root.append(fly);
      const run = fly.animate(frames, { duration: land * s, fill: 'forwards' });
      const last = i === count - 1;
      run.onfinish = () => { fly.remove(); pulse(counter, 'translateY(-50%)', 1.28, 180); if (last && value) pulse(value, '', 1.2, 300); };
      run.oncancel = () => fly.remove();
    }
  }

  private number(damage: number, at: { x: number; y: number }, final: boolean) {
    const n = this.numbers[this.nextNumber]; this.nextNumber = (this.nextNumber + 1) % MAX_NUMBERS;
    n.textContent = `-${formatNumber(Math.round(damage))}`;
    n.dataset.final = String(final);
    // Successive numbers step left and right of the block so a fast run of swings does not pile up.
    const dx = SPREAD[this.nextNumber];
    n.style.left = `${at.x + dx}px`; n.style.top = `${at.y}px`;
    n.getAnimations().forEach(a => a.cancel());
    n.animate([{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -110%) scale(1.15)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%, -260%) scale(1)', opacity: 0 }], { duration: (final ? NUMBER_MS + 200 : NUMBER_MS) * timeScale, easing: 'ease-out', fill: 'forwards' });
  }
}

function el(tag: string, className: string) { const e = document.createElement(tag); e.className = className; return e; }
/** A quick jump in size, from the start again when it comes while the last one runs. */
function pulse(element: HTMLElement, base: string, scale: number, ms: number) {
  element.getAnimations().forEach(a => a.cancel());
  element.animate([{ transform: `${base} scale(${scale})` }, { transform: `${base} scale(1)` }], { duration: ms, easing: 'ease-out' });
}
function bounce(element: HTMLElement) {
  element.getAnimations().forEach(a => a.cancel());
  element.animate([{ transform: 'translateY(-50%) scale(1)' }, { transform: 'translateY(-50%) scale(1.3)' }, { transform: 'translateY(-50%) scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2, 1.6, .4, 1)' });
}

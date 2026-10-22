// Mockup helpers: cube-pet portraits, ore gems and kit icons as inline SVG strings.
const INK = '#13355d';
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16), target = amount < 0 ? 0 : 255, t = Math.abs(amount);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (target - v) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const stroke = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;
function eyes(y = 54, r = 9) {
  const eye = x => `<ellipse cx="${x}" cy="${y}" rx="${r - 1}" ry="${r}" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="${x + 1.5}" cy="${y + 2}" rx="${r * .56}" ry="${r * .64}" fill="#1d2635"/><circle cx="${x + 3.5}" cy="${y - 1.5}" r="${r * .25}" fill="#fff"/>`;
  return eye(37) + eye(63);
}
const cheeks = `<ellipse cx="25" cy="67" rx="5" ry="3" fill="#ff7fa8" opacity=".75"/><ellipse cx="75" cy="67" rx="5" ry="3" fill="#ff7fa8" opacity=".75"/>`;
const mouth = `<path d="M45 68q2.5 3 5 0q2.5 3 5 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
function cube(color) {
  return `<rect x="17" y="28" width="66" height="60" rx="17" fill="${color}" ${stroke}/>
    <path d="M21 73h58v1a12 12 0 0 1-12 12H33a12 12 0 0 1-12-12Z" fill="${shade(color, -.28)}" opacity=".6"/>
    <path d="M27 37h18" stroke="${shade(color, .45)}" stroke-width="5" stroke-linecap="round"/>`;
}
const PET_PARTS = {
  slime: c => ({ body: `<path d="M18 78c0-30 12-50 32-50s32 20 32 50c0 8-6 10-12 10H30c-6 0-12-2-12-10Z" fill="${c}" ${stroke}/>
      <path d="M50 28c2-7 8-10 13-9-2 5-6 8-13 9Z" fill="${c}" ${stroke}/><path d="M30 44c3-6 8-9 13-10" stroke="${shade(c, .5)}" stroke-width="5" stroke-linecap="round" fill="none"/>` }),
  mole: c => ({ back: `<circle cx="24" cy="31" r="9" fill="${shade(c, -.15)}" ${stroke}/><circle cx="76" cy="31" r="9" fill="${shade(c, -.15)}" ${stroke}/>`,
    front: `<ellipse cx="50" cy="66" rx="7" ry="5" fill="#ff9db8" stroke="${INK}" stroke-width="2.5"/>` }),
  fox: c => ({ back: `<path d="M20 38 26 10l20 20Z" fill="${c}" ${stroke}/><path d="M80 38 74 10 54 30Z" fill="${c}" ${stroke}/><path d="m25 30 3-12 9 9Z M75 30l-3-12-9 9Z" fill="#ffd9c0"/>`,
    front: `<path d="M30 70c4-9 12-11 20-11s16 2 20 11c-3 9-11 13-20 13s-17-4-20-13Z" fill="#fff7ea" stroke="${INK}" stroke-width="2.5"/><ellipse cx="50" cy="64" rx="4.5" ry="3.4" fill="#1d2635"/>` }),
  owl: c => ({ back: `<path d="M18 40 22 14l16 16Z" fill="${shade(c, -.15)}" ${stroke}/><path d="M82 40 78 14 62 30Z" fill="${shade(c, -.15)}" ${stroke}/>`,
    front: `<circle cx="37" cy="54" r="13" fill="${shade(c, .55)}"/><circle cx="63" cy="54" r="13" fill="${shade(c, .55)}"/><path d="m44 66 6 9 6-9Z" fill="#ffb238" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    eyes: eyes(54, 10), mouth: '' }),
  dragon: c => ({ back: `<path d="M28 31 22 10l15 15Z" fill="#fff3c4" ${stroke}/><path d="M72 31l6-21-15 15Z" fill="#fff3c4" ${stroke}/>
      <path d="M17 58 4 48l4 22Z" fill="${shade(c, -.2)}" ${stroke}/><path d="m83 58 13-10-4 22Z" fill="${shade(c, -.2)}" ${stroke}/>`,
    front: `<path d="M36 75c4-6 9-8 14-8s10 2 14 8c-3 7-8 10-14 10s-11-3-14-10Z" fill="${shade(c, .5)}" stroke="${INK}" stroke-width="2.5"/><circle cx="46" cy="69" r="1.6" fill="${INK}"/><circle cx="54" cy="69" r="1.6" fill="${INK}"/>` , mouth: '' }),
  rabbit: c => ({ back: `<rect x="25" y="2" width="15" height="36" rx="7.5" fill="${c}" ${stroke}/><rect x="60" y="2" width="15" height="36" rx="7.5" fill="${c}" ${stroke}/><rect x="29.5" y="8" width="6" height="22" rx="3" fill="#ffc6d6"/><rect x="64.5" y="8" width="6" height="22" rx="3" fill="#ffc6d6"/>`,
    front: `<path d="m46 64 4 4 4-4Z" fill="#ff8fb0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` }),
  bear: c => ({ back: `<circle cx="24" cy="30" r="11" fill="${c}" ${stroke}/><circle cx="76" cy="30" r="11" fill="${c}" ${stroke}/><circle cx="24" cy="30" r="5" fill="${shade(c, .45)}"/><circle cx="76" cy="30" r="5" fill="${shade(c, .45)}"/>`,
    front: `<ellipse cx="50" cy="70" rx="13" ry="9" fill="${shade(c, .5)}" stroke="${INK}" stroke-width="2.5"/><ellipse cx="50" cy="66" rx="5" ry="3.6" fill="#1d2635"/>`, mouth: '' }),
  turtle: c => ({ back: `<path d="M22 44c0-14 12-22 28-22s28 8 28 22Z" fill="#7bbf5a" ${stroke}/><path d="M36 24l6 12h16l6-12M42 36l-8 8M58 36l8 8" fill="none" stroke="${INK}" stroke-width="2.5"/>` }),
  bird: c => ({ back: `<path d="M44 30c-2-10 4-18 10-20-1 8 2 12 6 16Z" fill="#ff7a5a" ${stroke}/>`, front: `<path d="m43 64 7 8 7-8Z" fill="#ffb238" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`, mouth: '' }),
};
function pet(kind, color) {
  const p = PET_PARTS[kind](color);
  return `<svg class="pet" viewBox="0 0 100 100"><ellipse cx="50" cy="93" rx="28" ry="5" fill="#0b1d33" opacity=".3"/>${p.back ?? ''}${p.body ?? cube(color)}${p.front ?? ''}${p.eyes ?? eyes()}${cheeks}${p.mouth ?? mouth}</svg>`;
}
function ore(color) {
  return `<svg class="ui-icon" viewBox="0 0 48 48"><path d="M13 8h22l8 11-19 22L5 19Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M5 19h38M13 8l6 11 5-11 5 11 6-11M19 19l5 22 5-22" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" opacity=".55"/><path d="M14 12l3 5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;
}
const lock = `<svg viewBox="0 0 48 48"><rect x="9" y="21" width="30" height="23" rx="5" fill="#ffd447" stroke="${INK}" stroke-width="3.5"/><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="24" cy="31" r="3.5" fill="${INK}"/></svg>`;
function eggArt(base, spot) {
  return `<svg viewBox="0 0 120 140" style="width:100%;height:100%"><ellipse cx="60" cy="128" rx="44" ry="8" fill="#0b1d33" opacity=".3"/>
    <path d="M22 112h76l-6 14H28Z" fill="#ffd447" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M60 8C34 8 20 50 20 76c0 24 18 38 40 38s40-14 40-38C100 50 86 8 60 8Z" fill="${base}" stroke="${INK}" stroke-width="5"/>
    <circle cx="44" cy="52" r="8" fill="${spot}"/><circle cx="74" cy="40" r="6" fill="${spot}"/><circle cx="78" cy="78" r="10" fill="${spot}"/><circle cx="46" cy="90" r="6" fill="${spot}"/>
    <path d="M38 30c4-8 9-12 15-14" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".8"/></svg>`;
}
function capsuleArt() {
  const balls = [['#ff6c9c', 44, 52], ['#ffd447', 66, 46], ['#53d8f2', 56, 66], ['#8be06e', 76, 66], ['#b67cf2', 38, 72]];
  return `<svg viewBox="0 0 120 140" style="width:100%;height:100%"><ellipse cx="60" cy="130" rx="44" ry="7" fill="#0b1d33" opacity=".3"/>
    <path d="M30 92h60l8 34H22Z" fill="#ef5a5a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="60" cy="56" r="40" fill="#dff6ff" fill-opacity=".85" stroke="${INK}" stroke-width="5"/>
    ${balls.map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${c}" stroke="${INK}" stroke-width="3"/>`).join('')}
    <path d="M36 34c5-8 12-12 20-13" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>
    <rect x="50" y="104" width="20" height="14" rx="4" fill="#ffd447" stroke="${INK}" stroke-width="3"/><rect x="26" y="88" width="68" height="10" rx="4" fill="#c63e4a" stroke="${INK}" stroke-width="4"/></svg>`;
}

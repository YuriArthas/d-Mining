import { resolveText } from '../../src/game/i18n/i18n.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORE_LOOKS } from '../../src/game/content/journeyResources.ts';
import { RESOURCES as JOURNEY_RESOURCES } from '../../src/game/content/resources.ts';

// CIELAB (D65) distance between two sRGB hex colours.
const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
function lab(hex) {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)));
  const x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const distance = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const hue = hex => { const [, a, b] = lab(hex); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };

const ores = JOURNEY_RESOURCES.filter(r => !r.base), rocks = JOURNEY_RESOURCES.filter(r => r.base && !r.itemId.endsWith('.deep'));

test('every ore has its own colour: within a world any two ores differ clearly, and each stands apart from its rock', () => {
  assert.equal(ores.length, 42);
  assert.equal(Object.keys(ORE_LOOKS).length, 42, 'one look per ore');
  for (let world = 0; world < 3; world++) {
    const set = ores.slice(world * 14, world * 14 + 14);
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      const d = distance(set[i].color, set[j].color);
      assert.ok(d >= 20, `${set[i].name} / ${set[j].name}: ΔE ${d.toFixed(1)}`);
    }
  }
  for (const ore of ores) {
    const rock = rocks.find(r => r.kind === ore.kind - (ore.kind % 4 === 2 ? 2 : 3));
    assert.ok(rock, ore.name);
    const d = distance(ore.color, rock.color);
    assert.ok(d >= 20, `${ore.name} on ${rock.name}: ΔE ${d.toFixed(1)}`);
  }
});

test('ore colours follow their names; metals glint and gems are glassy', () => {
  const byName = Object.fromEntries(ores.map(r => [resolveText(r.name), r]));
  const within = (name, from, to) => { const h = hue(byName[name].color); assert.ok(from < to ? h >= from && h <= to : h >= from || h <= to, `${name} hue ${h.toFixed(0)}`); };
  within('翡翠', 130, 180); within('红宝石', 340, 30); within('蓝宝石', 270, 310); within('金', 70, 100); within('紫水晶', 290, 330); within('铜', 40, 70);
  assert.ok(lab(byName['煤'].color)[0] < 25, 'coal is dark');
  for (const name of ['铜', '铁', '银', '金', '钴', '铂']) assert.equal(byName[name].pattern, 'metal', name);
  for (const name of ['翡翠', '红宝石', '钻石', '蓝宝石', '紫水晶']) assert.equal(byName[name].pattern, 'gem', name);
});

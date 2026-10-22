# Mining UI kit

One visual language for the HUD, dialogs and world prompts, matched to the original Roblox screens (`/root/uploads/Roblox场景与UI截图.zip`, shots 02, 04, 47, 48): bright cyan bodies, thick navy outlines, a 3D drop edge, outlined white display text and chunky icons. The art style of the scene is unchanged; this kit only covers screen UI.

## Files

| File | Role |
| --- | --- |
| `src/game/ui/kit/tokens.css` | Colours, font stacks, outline-text utility, no-select rules for the game shell |
| `src/game/ui/kit/kit.css` | Component styles: tile, button, close, pill, card, toast, panel |
| `src/game/ui/kit/controls.tsx` | `Tile`, `UiButton`, `CloseButton`, `Pill` (all built on `GameButton`) |
| `src/game/ui/kit/icons.tsx` | `Icon` vector set (48 × 48 grid, navy outline, two-tone fills) |
| `src/game/ui/kit/fonts.css` | Generated `@font-face` rules — do not edit |
| `tools/build-ui-fonts.py` | Font subsetter; writes `src/game/assets/fonts/` and `fonts.css` |

Kit components import `tokens.css` and `kit.css` themselves, so layout sheets that import a component always load after the kit and can override it.

## Typography

- Display text (numbers, titles, tile labels, buttons): `var(--ui-font)`. Latin and digits use Fredoka 600 (the open-source successor of Roblox's FredokaOne); Chinese uses Noto Sans SC Black (思源黑体 Black), chosen by the user on 2026-10-22 over 站酷庆科黄油体, 站酷快乐体 and 寒蝉半圆体.
- Body text (descriptions, help paragraphs): `var(--ui-font-body)`, the system CJK sans at bold weight. The display face is not used for long paragraphs.
- Outlined text: class `ui-outline` (white fill, navy `-webkit-text-stroke`, 2px drop). Set `--ui-stroke` to scale the outline.
- Both faces are SIL OFL 1.1 and renamed to “Mining Display …” in the subset, so no Reserved Font Name is reused by the modified font. Licences ship in `src/game/assets/fonts/licenses/`.
- After changing any player-visible text, run `python3 tools/build-ui-fonts.py`. `tools/tests/ui-fonts.test.mjs` fails if a character in `src/` is missing from the subset.

## Components

- **Tile** — square action button, icon on a coloured body, outlined label across the bottom, optional badge. Size from `--tile`. Tones: `blue` (default), `orange` (shop), `pink` (rewards), `purple`, `green`, `gold`, `red`, `steel`.
- **UiButton** — rectangular call to action. Sizes `s` (44px min), `m` (48px), `l` (56px). Positive actions green or orange, equip purple, destructive red, settings steel.
- **CloseButton** — red rounded square with a white X; sits on a panel's top-right corner.
- **Pill** — resource capsule: icon overhangs the left end, value in outlined text, optional meter (lighter band for the used share, gold body when full), optional tap action and a 44px “+” button.
- **ui-card** — navy translucent body for objectives, mining targets and other HUD information that must stay readable over the scene.
- **ui-toast** — short navy capsule for transient notices.
- **ui-panel** — the cyan dialog body with a diamond pattern. Used for popovers now; dialogs migrate to it in the panel steps (title above/over the top edge, CloseButton on the corner, dark-blue inset cells).

Touch targets are at least 44 × 44px. Every press goes through `GameButton`, which de-duplicates the compatibility click so closing a dialog never presses what is behind it.

## HUD layout (phone landscape first)

- Top-left: backpack pill (tap → mineral bag, “+” → route to the shop), coin pill, active buffs, then the objective card.
- Top-centre: world name and depth (“地表” on the surface, metres underground).
- Top-right: help and settings tiles; settings holds frame-rate cap, shadows and **exit** (exit is no longer a red corner button).
- Right edge: 宠物, 商店, 奖励, 更多. On phones 更多 opens 世界 / 传送 / 矿物; at ≥ 1000 × 620 every action is shown and there is no fold.
- Bottom-centre: mining target card, context prompts (扭蛋 / 矿区要求), notices, and 返回地表 only when underground.
- Bottom corners: thumbstick and jump (touch screens only).

Sizes are set per shell size with container queries in `src/game/ui/hud/hud.css` (`--hud-tile`, `--hud-pill`, …); the shell may be rotated in portrait, so the HUD never uses viewport units. The whole HUD hides while any dialog is open.

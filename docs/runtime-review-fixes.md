# Runtime/config review fixes

Baseline commit: `7be6b9a` (runtime decomposition, loading pipeline and texture changes).

## Corrections

- Preserve primitive parameters and apply room axis scaling after object rotation. `size` is not uniformly XYZ: ring and torus parameters include radius, thickness and angle. Added `worldScale` for the final spatial transform.
- Keep business interaction circles unscaled; the booth receives the sale/shop zone radius explicitly.
- Validate generated ordinary room colliders against the fixed shaft footprint before starting the engine. Reject obstructed layouts without moving objects automatically.
- Reject portal trigger/hysteresis overlap, identifying both destination IDs. Default 4 m station pitch is retained.
- Assemble generated surface detail data in `content/surfaceDetails.ts`. Grass, curbs, pond views, torch decorations, ground painting and boundary core consume explicit data. The existing compiled local-light table and authored bake remain build-time dependencies as documented in the content guide.

## Checks

- 269 automated tests passed, including new rotated-drum/beam bounds, preserved torus angle, sale radius, obstructed room, overlapping portal and injected detail placement cases.
- TypeScript and production build passed.
- Public test deployment: `https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html`; official Mining remains separate.
- Public runtime evidence is saved under `artifacts/review-fixes/public/`; this checks gameplay and rendering behavior, not device performance.
- Public flow passed: startup, day/night switching, deep travel, all destination unlocks, surface return, actual block destruction/collection and sale. Browser error list was empty. Inspected surface and deep screenshots.
- Default resource baseline retained: 1,113 model instances and 8,153,642 model payload bytes. These numbers do not represent total browser memory or real-device frame rate.

# Camera look trial

An adjustable approximation inspired by modern Roblox color/contrast treatment, not a port of Roblox's renderer.

- Entry: Mining 测试版, right-hand `画面：风格化 / 原始` toggle. Styled is the default; `?look=original` starts with the original image.
- Parameters: `src/game/content/cameraLook.ts`, separate day/night looks.
- Processing: copy the resolved display framebuffer to one RGBA8 texture, then render one full-screen triangle. Existing Neutral tone mapping, material exceptions, MSAA, alpha and UI remain intact. Input and output are already display encoded; no duplicate gamma/exposure conversion.
- Color: bounded midtone contrast, restrained green saturation, cool shadows, warm highlights, smooth containment of values near display white. This display-space pass cannot recover highlights already clipped by the original renderer.
- Cost: one color copy and one draw; no second world render, new depth buffer, MSAA render target, bloom pyramid or CPU pixel readback. At 1280×720 the color buffer is 3,686,400 bytes; at 1920×1080 it is 8,294,400 bytes. Driver/internal allocations are not included.
- Toggle: bypasses copy and full-screen drawing, retains the buffer for reuse. Resize replaces and releases the old buffer. Exit releases texture, geometry and material. The output shader is compiled during loading.
- Diagnostics: `window.__miningValidation.snapshot().renderer.cameraGrade` (with `?debug=1`) records copy/draw counts, estimated color bytes, allocations and CPU submission time. The existing GPU meter includes this pass in main rendering. CPU timing is not GPU cost.
- Validation: `tools/tests/camera-grade.test.mjs` covers bypass, frame order, resize, ownership, renderer-state restoration and cancelled prewarm. `tools/check-camera-grade.cjs` checks the public desktop version and saves day/night comparison images and runtime state to `artifacts/camera-grade/`.

References:
- https://create.roblox.com/docs/environment/post-processing-effects
- https://create.roblox.com/docs/environment/lighting
- https://threejs.org/docs/pages/FramebufferTexture.html

Validation result: 272 automated tests passed; after correcting the fullscreen vertex format, the three focused output-pass tests passed again and the production build passed. Public desktop checks passed for both looks, day/night, resize, deep travel and exit, with no browser errors. Night shader program counts were 30 in both modes, day counts 50 in both modes; switching the look did not compile additional variants. A resize to 900×500 used one 1,800,000-byte color buffer. Day/night screenshots were inspected; `artifacts/camera-grade/report.json` contains the completed functional run. These software-rendered checks are not phone/physical-GPU performance acceptance.

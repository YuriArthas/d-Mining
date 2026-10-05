import { pointerNdc } from './aim.ts';
import { GAME_CONFIG } from './config.ts';
import { GameInput, isGameKey, stickVector } from './GameInput.ts';
import { TouchGesture } from './TouchGesture.ts';

type Role = 'move' | 'surface' | 'jump';
type Owner = { role: Role; element: HTMLElement; x: number; y: number; gesture?: TouchGesture; timer?: number };
type Elements = { touchTarget: HTMLElement; surface: HTMLElement; stick: HTMLElement; knob: HTMLElement; jump: HTMLButtonElement };

export function bindInput(input: GameInput, elements: Elements) {
  const { surface, stick, knob, jump, touchTarget } = elements;
  const owners = new Map<number, Owner>();
  const removers: (() => void)[] = [];
  const portrait = window.matchMedia('(orientation: portrait)');
  let surfaceOwner: number | null = null;
  let mouseLook = false;
  let mouseX = 0, mouseY = 0;
  let resetRevision = input.resetRevision;
  // Inverse of the shell's clockwise 90-degree rotation. Input stays in game axes.
  const gameDelta = (x: number, y: number) => portrait.matches ? { x: y, y: -x } : { x, y };
  const listen = (target: EventTarget, type: string, listener: EventListener) => {
    target.addEventListener(type, listener, { passive: false });
    removers.push(() => target.removeEventListener(type, listener));
  };
  const setMouseAim = (event: MouseEvent) => {
    const point = pointerNdc(event.clientX, event.clientY, surface.getBoundingClientRect(), portrait.matches);
    const active = event.target instanceof Node && surface.contains(event.target) && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
    input.point(point.x, point.y, active); touchTarget.hidden = true;
    if (!active) input.mine('mouse', false);
  };
  // Pointer capture keeps delivery but must not let a held finger mine through UI.
  const onSurface = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y);
    return hit !== null && surface.contains(hit);
  };
  const aimTouch = (owner: Owner) => {
    const point = pointerNdc(owner.x, owner.y, surface.getBoundingClientRect(), portrait.matches);
    input.touchAim(point.x, point.y, true);
    touchTarget.style.left = `${(point.x + 1) * 50}%`;
    touchTarget.style.top = `${(1 - point.y) * 50}%`;
    touchTarget.dataset.phase = owner.gesture!.phase;
    touchTarget.hidden = false;
  };
  input.touchAim(); touchTarget.hidden = true;

  const updateStick = (x: number, y: number) => {
    const rect = stick.getBoundingClientRect();
    const { x: dx, y: dy } = gameDelta(x - rect.x - rect.width / 2, y - rect.y - rect.height / 2);
    const radius = GAME_CONFIG.input.stickRadius;
    const fraction = Math.min(1, radius / Math.max(1, Math.hypot(dx, dy)));
    knob.style.transform = `translate(${dx * fraction}px, ${dy * fraction}px)`;
    const vector = stickVector(dx, dy, radius, GAME_CONFIG.input.stickDeadZone);
    input.move(vector.x, vector.y);
  };
  const finishPointer = (id: number) => {
    const owner = owners.get(id);
    if (!owner) return;
    owners.delete(id); window.clearTimeout(owner.timer); owner.gesture?.end();
    if (owner.role === 'move') { input.move(0, 0); knob.style.transform = ''; }
    if (owner.role === 'jump') input.jump(`pointer:${id}`, false);
    if (surfaceOwner === id) {
      surfaceOwner = null; input.mine(`pointer:${id}`, false);
      input.touchAim(); touchTarget.hidden = true;
    }
    if (owner.element.hasPointerCapture(id)) owner.element.releasePointerCapture(id);
  };
  const releasePointers = () => { for (const id of [...owners.keys()]) finishPointer(id); };
  let lastJump: boolean | undefined;
  const paint = () => {
    if (resetRevision !== input.resetRevision) {
      resetRevision = input.resetRevision; mouseLook = false; releasePointers();
    }
    const state = input.getSnapshot();
    if (state.jumpHeld !== lastJump) jump.setAttribute('aria-pressed', String(state.jumpHeld));
    lastJump = state.jumpHeld;
  };
  const unsubscribe = input.subscribe(paint); paint();

  const attachPointer = (element: HTMLElement, role: Role) => {
    listen(element, 'pointerdown', ((event: PointerEvent) => {
      // Mouse chords use mousedown/up: pointerdown only fires for the first button.
      if (role === 'surface' && event.pointerType === 'mouse') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      // Extra world fingers never steal or inherit another finger's gesture.
      if (role === 'surface' && surfaceOwner !== null) return;
      if (role === 'move' && [...owners.values()].some(owner => owner.role === 'move')) return;
      const owner: Owner = { role, element, x: event.clientX, y: event.clientY };
      owners.set(event.pointerId, owner); element.setPointerCapture(event.pointerId);
      if (role === 'move') updateStick(event.clientX, event.clientY);
      if (role === 'jump') input.jump(`pointer:${event.pointerId}`, true);
      if (role === 'surface') {
        mouseLook = false; input.mine('mouse', false);
        surfaceOwner = event.pointerId;
        owner.gesture = new TouchGesture(owner.x, owner.y, performance.now()); aimTouch(owner);
        const hold = () => {
          if (owners.get(event.pointerId) !== owner) return;
          if (!onSurface(owner.x, owner.y)) { finishPointer(event.pointerId); return; }
          const phase = owner.gesture!.hold(performance.now());
          if (phase === 'pending') { owner.timer = window.setTimeout(hold, 1); return; }
          if (phase === 'mine') { aimTouch(owner); input.mine(`pointer:${event.pointerId}`, true); }
        };
        owner.timer = window.setTimeout(hold, GAME_CONFIG.input.mineHoldMs);
      }
    }) as EventListener);
    listen(element, 'pointermove', ((event: PointerEvent) => {
      const owner = owners.get(event.pointerId);
      if (!owner || owner.element !== element) return;
      event.preventDefault();
      owner.x = event.clientX; owner.y = event.clientY;
      if (owner.role === 'move') updateStick(owner.x, owner.y);
      else if (owner.gesture) {
        if (!onSurface(owner.x, owner.y)) { finishPointer(event.pointerId); return; }
        const delta = owner.gesture.move(owner.x, owner.y);
        if (owner.gesture.phase === 'look') {
          window.clearTimeout(owner.timer); input.touchAim(); touchTarget.hidden = true;
          const transformed = gameDelta(delta.x, delta.y), sensitivity = GAME_CONFIG.camera.touchSensitivity;
          input.look(transformed.x * sensitivity, transformed.y * sensitivity);
        } else aimTouch(owner);
      }
    }) as EventListener);
    listen(element, 'pointerup', ((event: PointerEvent) => {
      const owner = owners.get(event.pointerId);
      if (owner?.gesture && owner.element === element && onSurface(event.clientX, event.clientY)) {
        // Include final displacement even if the browser coalesced the last move.
        owner.gesture.move(event.clientX, event.clientY);
        owner.x = event.clientX; owner.y = event.clientY;
        if (owner.gesture.end(true)) { aimTouch(owner); input.pressMine(); }
      }
      finishPointer(event.pointerId);
    }) as EventListener);
    for (const type of ['pointercancel', 'lostpointercapture']) {
      listen(element, type, ((event: PointerEvent) => finishPointer(event.pointerId)) as EventListener);
    }
  };
  attachPointer(surface, 'surface'); attachPointer(stick, 'move'); attachPointer(jump, 'jump');

  // Ignore compatibility mouse events synthesized from touch on hybrid browsers.
  const touchMouse = (event: MouseEvent) => surfaceOwner !== null ||
    !!(event as MouseEvent & { sourceCapabilities?: { firesTouchEvents: boolean } }).sourceCapabilities?.firesTouchEvents;
  listen(surface, 'mousedown', ((event: MouseEvent) => {
    if (touchMouse(event) || (event.button !== 0 && event.button !== 2)) return;
    setMouseAim(event);
    event.preventDefault(); surface.focus({ preventScroll: true });
    if (event.button === 0) input.mine('mouse', true);
    if (event.button === 2) { mouseLook = true; mouseX = event.clientX; mouseY = event.clientY; }
  }) as EventListener);
  listen(window, 'mousemove', ((event: MouseEvent) => {
    if (touchMouse(event)) return;
    setMouseAim(event);
    if (!(event.buttons & 1)) input.mine('mouse', false);
    if (!(event.buttons & 2)) mouseLook = false;
    if (!mouseLook) return;
    const sensitivity = GAME_CONFIG.camera.mouseSensitivity;
    const delta = gameDelta(event.clientX - mouseX, event.clientY - mouseY);
    input.look(delta.x * sensitivity, delta.y * sensitivity);
    mouseX = event.clientX; mouseY = event.clientY;
  }) as EventListener);
  listen(surface, 'mouseleave', (() => { if (input.getAim().mode === 'mouse') { input.point(0, 0, false); input.mine('mouse', false); } }) as EventListener);
  listen(window, 'mouseup', ((event: MouseEvent) => {
    if (event.button === 0) input.mine('mouse', false);
    if (event.button === 2) mouseLook = false;
  }) as EventListener);
  listen(surface, 'pointercancel', (() => { mouseLook = false; input.mine('mouse', false); }) as EventListener);
  listen(surface, 'contextmenu', event => event.preventDefault());
  listen(window, 'keydown', ((event: KeyboardEvent) => {
    if (!isGameKey(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault(); input.key(event.code, true);
  }) as EventListener);
  listen(window, 'keyup', ((event: KeyboardEvent) => { if (isGameKey(event.code)) input.key(event.code, false); }) as EventListener);

  // Screen coordinate changes invalidate both timers and captured gestures.
  listen(portrait, 'change', () => input.reset());
  listen(window, 'resize', () => input.reset());
  return () => {
    unsubscribe();
    for (const remove of removers) remove();
    releasePointers(); mouseLook = false; input.reset();
  };
}

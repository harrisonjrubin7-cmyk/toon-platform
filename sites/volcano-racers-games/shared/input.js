// Keyboard + on-screen touch buttons, shared by all games.
// Actions: left, right, up, down, action (special/jump), pause.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'action', ShiftLeft: 'action', ShiftRight: 'action',
  Escape: 'pause', KeyP: 'pause',
};

export function createInput(target = window) {
  const held = new Set();
  const pressed = new Set(); // edge-triggered, cleared each frame by consume()
  let enabled = true;

  const down = (action) => {
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  };
  const up = (action) => held.delete(action);

  const onKeyDown = (e) => {
    const a = KEYMAP[e.code];
    if (!a || !enabled) return;
    // Don't steal keys from form fields or buttons (Space/Enter must still click buttons).
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return;
    e.preventDefault();
    down(a);
  };
  const onKeyUp = (e) => {
    const a = KEYMAP[e.code];
    if (a) up(a);
  };
  const onBlur = () => held.clear();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    isDown: (a) => enabled && held.has(a),
    wasPressed: (a) => enabled && pressed.has(a),
    consume: () => pressed.clear(),
    press: down,
    release: up,
    setEnabled(v) {
      enabled = v;
      if (!v) { held.clear(); pressed.clear(); }
    },
    // Wire elements with data-action="left" etc. to pointer events.
    bindTouch(root) {
      for (const el of root.querySelectorAll('[data-action]')) {
        const a = el.dataset.action;
        const start = (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); down(a); el.classList.add('is-down'); };
        const end = () => { up(a); el.classList.remove('is-down'); };
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('lostpointercapture', end);
      }
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

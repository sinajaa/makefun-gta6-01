const BLOCKED = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let locked = false;
  let lockCallback = null;

  window.addEventListener('keydown', (event) => {
    if (BLOCKED.has(event.code)) event.preventDefault();
    if (!event.repeat) edges.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); edges.clear(); });

  canvas.addEventListener('mousedown', (event) => {
    if (!locked && event.button === 0) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (lockCallback) lockCallback(locked);
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseX += event.movementX;
    mouseY += event.movementY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    down: (code) => held.has(code),
    pressed: (code) => edges.has(code),
    mouseX: () => mouseX,
    mouseY: () => mouseY,
    locked: () => locked,
    lock: () => canvas.requestPointerLock(),
    setLockCallback: (fn) => { lockCallback = fn; },
    endFrame: () => {
      edges.clear();
      mouseX = 0;
      mouseY = 0;
    },
  };
}

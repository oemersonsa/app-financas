import { onMounted, onUnmounted } from 'vue';

// Only small controls track the pointer; financial content remains visually stable.
export function useGlassReflection() {
  const selectors = '.sidebar nav a, .sidebar nav button, .month-picker, .primary, .mobile-add';
  let surface = null, pending = null, frame = 0, preference;
  function reset() {
    if (surface) {
      surface.style.removeProperty('--glass-x');
      surface.style.removeProperty('--glass-y');
    }
    surface = null;
  }
  function move(event) {
    if (!preference.matches || event.pointerType !== 'mouse') return;
    pending = { target: event.target, x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const target = pending.target instanceof Element ? pending.target.closest(selectors) : null;
      if (target !== surface) { reset(); surface = target; }
      if (!surface) return;
      const bounds = surface.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      surface.style.setProperty('--glass-x', `${Math.max(0, Math.min(100, (pending.x - bounds.left) / bounds.width * 100))}%`);
      surface.style.setProperty('--glass-y', `${Math.max(0, Math.min(100, (pending.y - bounds.top) / bounds.height * 100))}%`);
    });
  }
  function leave(event) { if (!event.relatedTarget) reset(); }
  function preferenceChanged() { if (!preference.matches) { cancelAnimationFrame(frame); frame = 0; reset(); } }
  onMounted(() => {
    preference = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', leave, { passive: true });
    window.addEventListener('blur', reset);
    preference.addEventListener('change', preferenceChanged);
  });
  onUnmounted(() => {
    cancelAnimationFrame(frame); reset();
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerout', leave);
    window.removeEventListener('blur', reset);
    preference?.removeEventListener('change', preferenceChanged);
  });
}

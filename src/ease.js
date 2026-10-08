/* Pure easing helpers. No DOM, no clock - every value is derived from its
 * arguments alone, which is what makes the timeline reproducible. */

export function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function lerp(a, b, x) {
  return a + (b - a) * x;
}

export function easeOut(x) {
  const c = clamp01(x);
  return 1 - Math.pow(1 - c, 3);
}

export function easeInOut(x) {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function ramp(t, start, duration) {
  if (duration <= 0) return t >= start ? 1 : 0;
  return clamp01((t - start) / duration);
}

// Shared spray-paint rendering logic. This file is intentionally duplicated
// (byte-for-byte) in client/src/spray.js so both the browser preview and the
// authoritative server renderer produce the same look without a cross-package
// import. If you change the art here, copy it over to the client too.

export const NOZZLES = {
  fine: { radius: 9, density: 16, dotMin: 0.5, dotMax: 1.4, spread: 1.0, alpha: 0.85, dripChance: 0.0 },
  standard: { radius: 20, density: 30, dotMin: 0.8, dotMax: 2.2, spread: 1.0, alpha: 0.55, dripChance: 0.02 },
  fat: { radius: 40, density: 64, dotMin: 1.2, dotMax: 3.2, spread: 1.0, alpha: 0.4, dripChance: 0.05 },
  splatter: { radius: 52, density: 20, dotMin: 2, dotMax: 7, spread: 1.4, alpha: 0.9, dripChance: 0.22 },
  mist: { radius: 58, density: 80, dotMin: 0.5, dotMax: 1.3, spread: 1.15, alpha: 0.16, dripChance: 0.0 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Returns the bounding box (in canvas pixels) that a dab could possibly touch,
// so callers can extract/broadcast only the affected region.
export function dabBounds(dab) {
  const nozzle = NOZZLES[dab.nozzle] || NOZZLES.standard;
  const sizeScale = dab.size || 1;
  const pad = nozzle.radius * nozzle.spread * sizeScale + 24; // extra for drips
  return {
    x: Math.floor(dab.x - pad),
    y: Math.floor(dab.y - pad),
    w: Math.ceil(pad * 2),
    h: Math.ceil(pad * 2 + 60), // drips extend downward
  };
}

export function drawDab(ctx, dab) {
  const nozzle = NOZZLES[dab.nozzle] || NOZZLES.standard;
  const sizeScale = dab.size || 1;
  const rand = mulberry32(dab.seed >>> 0);
  const radius = nozzle.radius * sizeScale;

  ctx.save();
  ctx.fillStyle = dab.color;

  for (let i = 0; i < nozzle.density; i++) {
    const angle = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.5) * radius * nozzle.spread;
    const dx = dab.x + Math.cos(angle) * r;
    const dy = dab.y + Math.sin(angle) * r;
    const dotR = (nozzle.dotMin + rand() * (nozzle.dotMax - nozzle.dotMin)) * sizeScale;
    const edgeFactor = 1 - clamp(r / (radius * nozzle.spread + 0.001), 0, 1);
    const a = clamp(nozzle.alpha * (0.25 + 0.75 * edgeFactor) * (0.65 + 0.35 * rand()), 0, 1);

    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(dx, dy, Math.max(0.35, dotR), 0, Math.PI * 2);
    ctx.fill();
  }

  if (rand() < nozzle.dripChance) {
    const dripX = dab.x + (rand() - 0.5) * radius * 0.6;
    const dripLen = 18 + rand() * 70;
    const dripW = 1 + rand() * 2.6 * sizeScale;
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const y = dab.y + t * dripLen;
      const w = dripW * (1 - t * 0.7);
      ctx.globalAlpha = clamp(nozzle.alpha * 0.8 * (1 - t * 0.6), 0, 1);
      ctx.beginPath();
      ctx.arc(dripX + Math.sin(t * 6 + dab.seed) * 1.2, y, Math.max(0.3, w / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

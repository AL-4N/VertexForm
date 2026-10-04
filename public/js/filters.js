/**
 * filters.js — landmark smoothing (pure, no DOM).
 *
 * The One Euro filter (Casiez, Roussel & Vogel, CHI 2012) is a low-pass
 * filter whose cutoff rises with speed: when a joint is still it smooths
 * hard (kills jitter), when it moves it smooths lightly (no lag). That's
 * exactly the trade-off pose tracking needs.
 *
 * Units: landmark x/y are fractions of the frame (0..1), time is seconds.
 * A joint moving during a squat travels ~0.3–1 frame/s; MediaPipe jitter on
 * a still joint is ~0.002–0.004 frame.
 */

/**
 * All smoothing parameters in one place.
 *   minCutoff  Hz when still: lower = smoother but laggier at rest
 *   beta       how fast the cutoff rises with speed: higher = less lag when moving
 *   dCutoff    Hz for smoothing the speed estimate itself
 *   resetGapS  a gap longer than this (person lost) restarts the filter
 */
export const SMOOTHING = {
  // Measurement + display: steady angles, ~25–35 ms lag mid-movement.
  measure: { minCutoff: 1.2, beta: 8, dCutoff: 1.0, resetGapS: 0.5 },
  // Rep-phase signal: lighter, so the top/bottom of a rep is caught promptly.
  phase:   { minCutoff: 3.0, beta: 14, dCutoff: 1.0, resetGapS: 0.5 },
};

const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  constructor({ minCutoff = 1.0, beta = 0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.x = null;     // last filtered value
    this.dx = 0;       // last filtered speed
    this.t = null;
  }

  /** Filter one sample `v` taken at time `t` (seconds). */
  filter(v, t) {
    if (this.x == null || this.t == null || t <= this.t) {
      if (this.x == null) { this.x = v; this.t = t; }
      return this.x;
    }
    const dt = t - this.t;
    this.t = t;
    const rawDx = (v - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}

/**
 * One filter per landmark per axis (x, y, z). Visibility is passed through
 * unchanged: it's a confidence, not a position.
 */
export class LandmarkSmoother {
  constructor(params = SMOOTHING.measure) {
    this.params = params;
    this.filters = null;
    this.lastT = null;
  }

  reset() {
    this.filters = null;
    this.lastT = null;
  }

  /**
   * @param lms  landmarks [{x, y, z, visibility}]
   * @param tMs  timestamp in milliseconds
   * @returns a new, smoothed landmark array
   */
  apply(lms, tMs) {
    if (!lms) return lms;
    const t = tMs / 1000;
    if (this.lastT != null && t - this.lastT > this.params.resetGapS) this.reset();
    this.lastT = t;
    if (!this.filters || this.filters.length !== lms.length) {
      this.filters = lms.map(() => [new OneEuro(this.params), new OneEuro(this.params), new OneEuro(this.params)]);
    }
    return lms.map((p, i) => {
      const [fx, fy, fz] = this.filters[i];
      return { x: fx.filter(p.x, t), y: fy.filter(p.y, t), z: fz.filter(p.z ?? 0, t), visibility: p.visibility ?? 1 };
    });
  }
}

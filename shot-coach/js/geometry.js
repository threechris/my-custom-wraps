// Small vector/angle helpers. All points are {x, y} (normalized image coords,
// y grows downward) unless noted. World-landmark helpers take {x, y, z} in meters.

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Interior angle at vertex b of triangle a-b-c, in degrees [0, 180].
export function angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const d = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (m === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, d / m))) * 180) / Math.PI;
}

// Same as angleAt but in 3D, for world landmarks.
export function angleAt3D(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y, a.z - b.z];
  const v2 = [c.x - b.x, c.y - b.y, c.z - b.z];
  const d = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const m = Math.hypot(...v1) * Math.hypot(...v2);
  if (m === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, d / m))) * 180) / Math.PI;
}

// Angle of the segment from -> to, measured from vertical (up), degrees [0, 180].
// 0 means the segment points straight up in the image.
export function angleFromVertical(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y; // y down
  const m = Math.hypot(dx, dy);
  if (m === 0) return 0;
  // Up vector is (0, -1)
  return (Math.acos(Math.max(-1, Math.min(1, -dy / m))) * 180) / Math.PI;
}

// Perpendicular distance from point p to the (infinite) 3D line through a and b.
export function pointLineDist3D(p, a, b) {
  const ab = [b.x - a.x, b.y - a.y, b.z - a.z];
  const ap = [p.x - a.x, p.y - a.y, p.z - a.z];
  const abLen = Math.hypot(...ab);
  if (abLen === 0) return Math.hypot(...ap);
  const cross = [
    ab[1] * ap[2] - ab[2] * ap[1],
    ab[2] * ap[0] - ab[0] * ap[2],
    ab[0] * ap[1] - ab[1] * ap[0],
  ];
  return Math.hypot(...cross) / abLen;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Exponential moving average of {x, y} points (and optional z).
export class PointEMA {
  constructor(alpha) {
    this.alpha = alpha;
    this.value = null;
  }
  update(p) {
    if (!p) return this.value;
    if (!this.value) {
      this.value = { ...p };
    } else {
      const a = this.alpha;
      this.value.x = lerp(this.value.x, p.x, a);
      this.value.y = lerp(this.value.y, p.y, a);
      if (p.z !== undefined) this.value.z = lerp(this.value.z ?? p.z, p.z, a);
    }
    return this.value;
  }
  reset() {
    this.value = null;
  }
}

export class ScalarEMA {
  constructor(alpha, initial = null) {
    this.alpha = alpha;
    this.value = initial;
  }
  update(v) {
    if (v == null || Number.isNaN(v)) return this.value;
    this.value = this.value == null ? v : lerp(this.value, v, this.alpha);
    return this.value;
  }
  reset() {
    this.value = null;
  }
}

// Least-squares parabola fit y = a x^2 + b x + c over points [{x, y}, ...].
// Returns {a, b, c} or null if degenerate / too few points.
export function fitParabola(points) {
  const n = points.length;
  if (n < 3) return null;
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
  for (const p of points) {
    const x = p.x, y = p.y;
    const x2 = x * x;
    sx += x; sx2 += x2; sx3 += x2 * x; sx4 += x2 * x2;
    sy += y; sxy += x * y; sx2y += x2 * y;
  }
  // Solve [sx4 sx3 sx2; sx3 sx2 sx; sx2 sx n] * [a b c]' = [sx2y sxy sy]'
  const M = [
    [sx4, sx3, sx2, sx2y],
    [sx3, sx2, sx, sxy],
    [sx2, sx, n, sy],
  ];
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < 3; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  const c = M[2][3] / M[2][2];
  const b = (M[1][3] - M[1][2] * c) / M[1][1];
  const a = (M[0][3] - M[0][2] * c - M[0][1] * b) / M[0][0];
  return { a, b, c };
}

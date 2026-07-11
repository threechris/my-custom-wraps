// Tracks a basketball by its orange color in a downsampled copy of the video
// frame, returning a normalized centroid + radius. Robust-ish to skin and wood
// courts via saturation/ratio thresholds and blob-size limits; a sensitivity
// setting relaxes or tightens the color gate for tricky lighting.

const SAMPLE_W = 192;

export class BallTracker {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.sampleH = 0;
    this.sensitivity = 1; // 0 strict, 1 normal, 2 loose
    this.last = null; // {x, y, r, t} normalized
  }

  setSensitivity(level) {
    this.sensitivity = level;
  }

  reset() {
    this.last = null;
  }

  // Color gate for basketball orange. r,g,b 0-255.
  isBall(r, g, b) {
    const s = this.sensitivity;
    const minR = [110, 90, 70][s];
    const minRB = [70, 55, 40][s];
    const maxGR = [0.62, 0.68, 0.74][s];
    if (r < minR) return false;
    if (r - b < minRB) return false;
    const gr = g / r;
    if (gr < 0.2 || gr > maxGR) return false;
    if (b > g * 1.05) return false;
    return true;
  }

  // Detect the ball. `predict` is an optional {x, y, maxDist} normalized hint;
  // when given, only blobs near the prediction are accepted (used during flight
  // so a jersey or another ball elsewhere in frame can't hijack the track).
  detect(video, nowMs, predict = null) {
    if (video.readyState < 2 || !video.videoWidth) return null;
    const aspect = video.videoHeight / video.videoWidth;
    const w = SAMPLE_W;
    const h = Math.round(SAMPLE_W * aspect);
    if (this.sampleH !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.sampleH = h;
    }
    this.ctx.drawImage(video, 0, 0, w, h);
    let data;
    try {
      data = this.ctx.getImageData(0, 0, w, h).data;
    } catch {
      return null;
    }

    // Coarse grid of 4x4-sample cells; count ball-colored pixels per cell.
    const cell = 4;
    const gw = Math.ceil(w / cell);
    const gh = Math.ceil(h / cell);
    const counts = new Uint16Array(gw * gh);
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      const gy = (y / cell) | 0;
      for (let x = 0; x < w; x++) {
        const i = row + x * 4;
        if (this.isBall(data[i], data[i + 1], data[i + 2])) {
          counts[gy * gw + ((x / cell) | 0)]++;
        }
      }
    }

    // Connected components over cells with enough hits.
    const minCellHits = 5;
    const seen = new Uint8Array(gw * gh);
    let best = null;
    for (let idx = 0; idx < counts.length; idx++) {
      if (seen[idx] || counts[idx] < minCellHits) continue;
      // BFS
      let sumX = 0, sumY = 0, sumC = 0, nCells = 0;
      let minX = gw, maxX = 0, minY = gh, maxY = 0;
      const stack = [idx];
      seen[idx] = 1;
      while (stack.length) {
        const c = stack.pop();
        const cx = c % gw, cy = (c / gw) | 0;
        const n = counts[c];
        sumX += cx * n; sumY += cy * n; sumC += n; nCells++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neigh = [c - 1, c + 1, c - gw, c + gw];
        for (const nb of neigh) {
          if (nb < 0 || nb >= counts.length || seen[nb]) continue;
          const nbx = nb % gw;
          if (Math.abs(nbx - cx) > 1) continue; // row wrap guard
          if (counts[nb] >= minCellHits) {
            seen[nb] = 1;
            stack.push(nb);
          }
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      // Reject blobs that are clearly not a ball: too small, too large,
      // or very elongated (arms, court lines, jerseys).
      if (nCells < 2) continue;
      if (bw > gw * 0.4 || bh > gh * 0.4) continue;
      const elong = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
      if (elong > 2.6) continue;
      const blob = {
        x: (sumX / sumC + 0.5) * cell / w,
        y: (sumY / sumC + 0.5) * cell / h,
        r: (Math.sqrt((sumC * 1.0)) * 0.6) * 1 / w * cell, // rough normalized radius
        mass: sumC,
      };
      if (predict) {
        const d = Math.hypot(blob.x - predict.x, blob.y - predict.y);
        if (d > predict.maxDist) continue;
        // Prefer the blob closest to the prediction.
        if (!best || d < best._d) {
          blob._d = d;
          best = blob;
        }
      } else if (!best || blob.mass > best.mass) {
        best = blob;
      }
    }

    if (best) {
      this.last = { x: best.x, y: best.y, r: best.r, t: nowMs };
      return this.last;
    }
    return null;
  }
}

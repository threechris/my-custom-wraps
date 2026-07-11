import { LM } from "./poseEngine.js";

// Draws the live overlay (skeleton, ball, trace, release badge) onto a canvas
// that exactly covers the video. All inputs are normalized coords; the canvas
// context is NOT mirrored here — mirroring is done with CSS on the container
// so video and overlay stay in the same space.

const BONES = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
];

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.releaseBadge = null; // {x, y, deg, until}
  }

  resize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  px(p) {
    return [p.x * this.canvas.width, p.y * this.canvas.height];
  }

  drawSkeleton(landmarks, shootingHand) {
    const ctx = this.ctx;
    const armIdx = shootingHand === "right"
      ? new Set([LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST])
      : new Set([LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST]);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const [a, b] of BONES) {
      const pa = landmarks[a], pb = landmarks[b];
      if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
      const shootingArm = armIdx.has(a) && armIdx.has(b);
      ctx.strokeStyle = shootingArm ? "rgba(57,135,229,0.95)" : "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(...this.px(pa));
      ctx.lineTo(...this.px(pb));
      ctx.stroke();
    }
    // Joints on the shooting arm
    ctx.fillStyle = "#3987e5";
    for (const i of armIdx) {
      const [x, y] = this.px(landmarks[i]);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBall(ball) {
    if (!ball) return;
    const ctx = this.ctx;
    const [x, y] = this.px(ball);
    const r = Math.max(6, ball.r * this.canvas.width);
    ctx.strokeStyle = "#eda100";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Recent ball path; flight (post-release) drawn brighter.
  drawTrail(trail, tRelease, now) {
    const ctx = this.ctx;
    if (trail.length < 2) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      if (b.t - a.t > 250) continue; // gap in tracking
      const age = now - b.t;
      const alpha = Math.max(0, 1 - age / 3500);
      if (alpha <= 0) continue;
      const inFlight = tRelease != null && b.t >= tRelease;
      ctx.strokeStyle = inFlight
        ? `rgba(237,161,0,${(0.95 * alpha).toFixed(3)})`
        : `rgba(237,161,0,${(0.35 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(...this.px(a));
      ctx.lineTo(...this.px(b));
      ctx.stroke();
    }
  }

  showRelease(point, deg, now) {
    this.releaseBadge = { ...point, deg, until: now + 3500 };
  }

  drawReleaseBadge(now) {
    const b = this.releaseBadge;
    if (!b || now > b.until) return;
    const ctx = this.ctx;
    const [x, y] = this.px(b);
    ctx.fillStyle = "rgba(13,13,13,0.75)";
    const label = b.deg != null ? `${Math.round(b.deg)}°` : "release";
    ctx.font = "600 16px system-ui, -apple-system, sans-serif";
    const w = ctx.measureText(label).width + 16;
    const bx = Math.min(Math.max(4, x - w / 2), this.canvas.width - w - 4);
    const by = Math.max(24, y - 34);
    ctx.beginPath();
    ctx.roundRect(bx, by - 18, w, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, bx + 8, by);
    // Marker at the release point
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawPhaseHint(text) {
    if (!text) return;
    const ctx = this.ctx;
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    const w = ctx.measureText(text).width + 20;
    const x = (this.canvas.width - w) / 2;
    ctx.fillStyle = "rgba(13,13,13,0.6)";
    ctx.beginPath();
    ctx.roundRect(x, 12, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x + 10, 32);
  }
}

// Renders a completed shot's trace into a standalone card canvas
// (used in the "Last shot" panel), including the fitted arc.
export function renderShotCard(canvas, shot, aspect, mirror = false) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#1a1a19";
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 10);
  ctx.fill();

  // Mirror by flipping x in the projection (not with a canvas/CSS transform)
  // so text labels stay readable.
  const px = (p) => [(mirror ? 1 - p.x : p.x) * W, p.y * H];

  // Skeleton snapshot of the shooting arm at release
  const sk = shot.skeleton;
  if (sk) {
    ctx.strokeStyle = "rgba(57,135,229,0.9)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(...px(sk.shoulder));
    ctx.lineTo(...px(sk.elbow));
    ctx.lineTo(...px(sk.wrist));
    ctx.stroke();
  }

  // Ball trail
  if (shot.trail.length > 1) {
    ctx.lineWidth = 2.5;
    for (let i = 1; i < shot.trail.length; i++) {
      const a = shot.trail[i - 1], b = shot.trail[i];
      if (b.t - a.t > 250) continue;
      const inFlight = b.t >= (shot.flight[0]?.t ?? Infinity);
      ctx.strokeStyle = inFlight ? "rgba(237,161,0,0.95)" : "rgba(237,161,0,0.35)";
      ctx.beginPath();
      ctx.moveTo(...px(a));
      ctx.lineTo(...px(b));
      ctx.stroke();
    }
  }

  // Fitted arc (dashed), drawn in the same normalized space.
  if (shot.arcFit && shot.arcPoints.length >= 2) {
    const { a, b, c } = shot.arcFit;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const x0 = shot.arcPoints[0].x;
    const x1 = shot.arcPoints[shot.arcPoints.length - 1].x;
    const n = 24;
    for (let i = 0; i <= n; i++) {
      // arcPoints x was aspect-corrected; undo for drawing
      const xa = x0 + ((x1 - x0) * i) / n;
      const y = a * xa * xa + b * xa + c;
      const [cx, cy] = px({ x: xa / aspect, y });
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Release point + angle
  if (shot.releasePoint) {
    const [x, y] = px(shot.releasePoint);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    if (shot.metrics.releaseAngleDeg != null) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 13px system-ui, -apple-system, sans-serif";
      const label = `${shot.metrics.releaseAngleDeg}°`;
      ctx.fillText(label, Math.min(x + 10, W - 30), Math.max(14, y - 10));
    }
  }
}

import { LM } from "./poseEngine.js";
import {
  angleAt, angleFromVertical, dist, mid, clamp, fitParabola, ScalarEMA,
} from "./geometry.js";

// Tunable thresholds. Distances are in torso-lengths (shoulder-mid to hip-mid),
// times in ms, angles in degrees, velocities in torso-lengths per second.
const T = {
  kneeFlexTrigger: 12,      // knee bend below standing baseline that starts a shot
  riseVy: -1.1,             // upward wrist velocity that marks the rise
  releaseElbow: 152,        // elbow extension that (with height) marks release
  releaseBallSep: 0.32,     // ball-to-wrist distance that marks ball leaving hand
  followWindowMs: 950,      // how long after release we keep measuring
  loadTimeoutMs: 4000,
  riseTimeoutMs: 2500,
  cooldownMs: 900,
  minFlightPoints: 4,
};

const PHASES = ["idle", "load", "rise", "follow", "cooldown"];

export class ShotAnalyzer {
  constructor({ shootingHand = "right", onShot = null } = {}) {
    this.shootingHand = shootingHand;
    this.onShot = onShot;
    this.phase = "idle";
    this.samples = [];        // ring buffer of per-frame body samples
    this.ballTrail = [];      // all recent ball sightings {t,x,y,r}
    this.flight = [];         // post-release ball points
    this.kneeBase = new ScalarEMA(0.03);
    this.facing = new ScalarEMA(0.1); // +1 facing image-right, -1 image-left
    this.shot = null;         // in-progress shot record
    this.lastShot = null;     // last completed shot
    this.phaseSince = 0;
    this.framing = "no-person";
    this.live = {};           // live HUD values
  }

  setShootingHand(hand) {
    this.shootingHand = hand;
  }

  idx(name) {
    const right = this.shootingHand === "right";
    const map = {
      wrist: right ? LM.RIGHT_WRIST : LM.LEFT_WRIST,
      elbow: right ? LM.RIGHT_ELBOW : LM.LEFT_ELBOW,
      shoulder: right ? LM.RIGHT_SHOULDER : LM.LEFT_SHOULDER,
      index: right ? LM.RIGHT_INDEX : LM.LEFT_INDEX,
      hip: right ? LM.RIGHT_HIP : LM.LEFT_HIP,
      knee: right ? LM.RIGHT_KNEE : LM.LEFT_KNEE,
      ankle: right ? LM.RIGHT_ANKLE : LM.LEFT_ANKLE,
      guideWrist: right ? LM.LEFT_WRIST : LM.RIGHT_WRIST,
      guideShoulder: right ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER,
    };
    return map[name];
  }

  reset() {
    this.phase = "idle";
    this.shot = null;
    this.flight = [];
  }

  setPhase(phase, t) {
    this.phase = phase;
    this.phaseSince = t;
  }

  // Hint for the ball tracker: where to look, or null for a global search.
  ballHint() {
    if (this.phase === "follow" && this.flight.length >= 2) {
      const a = this.flight[this.flight.length - 2];
      const b = this.flight[this.flight.length - 1];
      const dt = Math.max(1, b.t - a.t);
      const lookAhead = 80; // ms
      return {
        x: b.x + ((b.x - a.x) / dt) * lookAhead,
        y: b.y + ((b.y - a.y) / dt) * lookAhead,
        maxDist: 0.14,
      };
    }
    const s = this.samples[this.samples.length - 1];
    if (s && (this.phase === "load" || this.phase === "rise")) {
      // Ball should be near the shooting hand.
      return { x: s.wrist.x, y: s.wrist.y, maxDist: 0.28 };
    }
    return null;
  }

  // Main per-frame update. pose: {landmarks, world} | null, ball: {x,y,r} | null.
  update(t, pose, ball) {
    if (ball) {
      this.ballTrail.push({ ...ball, t });
      if (this.ballTrail.length > 240) this.ballTrail.shift();
      if (this.phase === "follow") {
        // Accept only rising-then-falling flight points; gate handled by hint.
        this.flight.push({ ...ball, t });
      }
    }

    if (!pose) {
      this.framing = "no-person";
      if (this.phase !== "idle" && t - this.phaseSince > 1500) this.reset();
      return;
    }

    const lm = pose.landmarks;
    const vis = (i) => lm[i].visibility ?? 1;
    const fullBody =
      vis(LM.NOSE) > 0.5 &&
      (vis(LM.LEFT_ANKLE) > 0.5 || vis(LM.RIGHT_ANKLE) > 0.5) &&
      (vis(LM.LEFT_KNEE) > 0.5 || vis(LM.RIGHT_KNEE) > 0.5);
    this.framing = fullBody ? "ok" : "partial";

    const shoulderMid = mid(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = mid(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const torso = Math.max(0.02, dist(shoulderMid, hipMid));
    const earMid = mid(lm[LM.LEFT_EAR], lm[LM.RIGHT_EAR]);
    const headUnit = Math.max(0.01, dist(lm[LM.NOSE], earMid) * 1.6);
    const headTopY = Math.min(lm[LM.NOSE].y, earMid.y) - headUnit;

    // Which way the shooter faces (nose leads the shoulders).
    const facing = this.facing.update(Math.sign(lm[LM.NOSE].x - earMid.x) || 1);

    const wrist = { x: lm[this.idx("wrist")].x, y: lm[this.idx("wrist")].y };
    const kneeAngle = Math.min(
      angleAt(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]),
      angleAt(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE])
    );
    const elbowAngle = angleAt(
      lm[this.idx("shoulder")], lm[this.idx("elbow")], lm[this.idx("wrist")]
    );

    const sample = {
      t, wrist, kneeAngle, elbowAngle, torso, headTopY, facing,
      noseY: lm[LM.NOSE].y,
      eyeY: Math.min(lm[LM.LEFT_EYE].y, lm[LM.RIGHT_EYE].y),
      shoulderY: lm[this.idx("shoulder")].y,
      guideWrist: { x: lm[this.idx("guideWrist")].x, y: lm[this.idx("guideWrist")].y },
      indexTip: { x: lm[this.idx("index")].x, y: lm[this.idx("index")].y },
      elbowPt: { x: lm[this.idx("elbow")].x, y: lm[this.idx("elbow")].y },
      shoulderPt: { x: lm[this.idx("shoulder")].x, y: lm[this.idx("shoulder")].y },
      world: pose.world,
    };
    this.samples.push(sample);
    if (this.samples.length > 360) this.samples.shift();

    const wristVy = this.wristVelY(t, torso);
    this.live = {
      phase: this.phase, kneeAngle, elbowAngle, wristVy,
      facing, framing: this.framing,
    };

    switch (this.phase) {
      case "idle": {
        // Learn the standing knee angle while the shooter is upright & still.
        if (kneeAngle > 150 && Math.abs(wristVy) < 0.6) this.kneeBase.update(kneeAngle);
        const base = this.kneeBase.value ?? 172;
        const kneesFlexing = kneeAngle < base - T.kneeFlexTrigger;
        const ballBelowHead = wrist.y > sample.noseY;
        if (kneesFlexing && ballBelowHead) {
          this.beginShot(t, sample);
        }
        break;
      }
      case "load": {
        const s = this.shot;
        if (kneeAngle < s.minKnee) {
          s.minKnee = kneeAngle;
          s.tDeepest = t;
        }
        if (wrist.y > s.dipY) {
          s.dipY = wrist.y;
          s.tDipBottom = t;
        }
        // Knees extending marks the start of leg drive.
        if (!s.tLegDrive && s.tDeepest && kneeAngle > s.minKnee + 6) {
          s.tLegDrive = t;
        }
        if (wristVy < T.riseVy && wrist.y < s.dipY - 0.08 * torso) {
          this.setPhase("rise", t);
        } else if (t - this.phaseSince > T.loadTimeoutMs || kneeAngle > (this.kneeBase.value ?? 172) - 4 && t - this.phaseSince > 1200 && !s.tLegDrive) {
          this.reset(); // stood back up without shooting
        }
        break;
      }
      case "rise": {
        const s = this.shot;
        if (!s.tLegDrive && kneeAngle > s.minKnee + 6) s.tLegDrive = t;
        if (s.minElbowRise == null || elbowAngle < s.minElbowRise) {
          s.minElbowRise = elbowAngle;
        }
        if (!s.tArmDrive && s.minElbowRise != null && elbowAngle > s.minElbowRise + 18 && wrist.y < sample.shoulderY + 0.2 * torso) {
          s.tArmDrive = t;
        }
        // Set point: wrist passes eye level on the way up.
        if (!s.setPoint && wrist.y < sample.eyeY) {
          s.setPoint = this.captureSetPoint(sample);
        }
        // Knee extension finished
        if (!s.tLegsDone && kneeAngle > (this.kneeBase.value ?? 172) - 6) {
          s.tLegsDone = t;
        }

        let released = false;
        let source = null;
        const b = this.latestBall(t, 120);
        if (b) {
          const sep = Math.hypot(b.x - wrist.x, b.y - wrist.y) / torso;
          const ballAbove = b.y < wrist.y + 0.05;
          if (sep > T.releaseBallSep && ballAbove && this.ballRising(t)) {
            released = true;
            source = "ball";
          }
        }
        if (!released && elbowAngle > T.releaseElbow && wrist.y < sample.noseY) {
          released = true;
          source = "pose";
        }
        if (released) {
          this.captureRelease(t, sample, source);
          this.setPhase("follow", t);
        } else if (t - this.phaseSince > T.riseTimeoutMs) {
          this.reset();
        }
        break;
      }
      case "follow": {
        const s = this.shot;
        if (elbowAngle > s.followMaxElbow) s.followMaxElbow = elbowAngle;
        const extended = elbowAngle > 155 && wrist.y < sample.shoulderY;
        const dtFrame = t - (this.samples[this.samples.length - 2]?.t ?? t);
        if (extended) s.followHoldMs += dtFrame;
        // Wrist snap: fingertips dip below the wrist while the arm is up.
        if (
          !s.wristSnap && t - s.tRelease > 60 &&
          sample.indexTip.y > wrist.y + 0.04 * torso &&
          wrist.y < sample.noseY
        ) {
          s.wristSnap = true;
        }
        if (!s.guideSepRatio && t - s.tRelease > 110) {
          s.guideSepRatio = dist(sample.guideWrist, wrist) / torso;
        }
        if (t - s.tRelease > T.followWindowMs) {
          this.finalizeShot(t);
          this.setPhase("cooldown", t);
        }
        break;
      }
      case "cooldown": {
        if (t - this.phaseSince > T.cooldownMs) {
          this.shot = null;
          this.flight = [];
          this.setPhase("idle", t);
        }
        break;
      }
    }
    this.live.phase = this.phase;
  }

  beginShot(t, sample) {
    this.shot = {
      tStart: t,
      minKnee: sample.kneeAngle,
      tDeepest: t,
      dipY: sample.wrist.y,
      tDipBottom: t,
      tLegDrive: null,
      tArmDrive: null,
      tLegsDone: null,
      minElbowRise: null,
      setPoint: null,
      release: null,
      tRelease: null,
      followMaxElbow: 0,
      followHoldMs: 0,
      wristSnap: false,
      guideSepRatio: null,
      torso: sample.torso,
      facing: sample.facing >= 0 ? 1 : -1,
    };
    this.flight = [];
    this.setPhase("load", t);
  }

  captureSetPoint(sample) {
    const sp = {
      t: sample.t,
      forearmVertDeg: angleFromVertical(sample.elbowPt, sample.wrist),
      elbowFlareDeg: null,
    };
    // Elbow flare from 3D world landmarks: how much the upper arm points
    // sideways (along the shoulder-to-shoulder axis) instead of staying in
    // the shooting plane.
    const w = sample.world;
    if (w) {
      const rs = w[LM.RIGHT_SHOULDER], ls = w[LM.LEFT_SHOULDER];
      const sh = w[this.idx("shoulder")], el = w[this.idx("elbow")];
      const med = { x: rs.x - ls.x, y: rs.y - ls.y, z: rs.z - ls.z };
      const medLen = Math.hypot(med.x, med.y, med.z) || 1;
      const ua = { x: el.x - sh.x, y: el.y - sh.y, z: el.z - sh.z };
      const uaLen = Math.hypot(ua.x, ua.y, ua.z) || 1;
      let lat = (ua.x * med.x + ua.y * med.y + ua.z * med.z) / (medLen * uaLen);
      // Outward is +medial axis for the right arm, -medial for the left.
      if (this.shootingHand === "left") lat = -lat;
      sp.elbowFlareDeg = Math.asin(clamp(lat, -1, 1)) * (180 / Math.PI);
    }
    return sp;
  }

  captureRelease(t, sample, source) {
    const s = this.shot;
    s.tRelease = t;
    s.releaseSource = source;
    const b = this.latestBall(t, 150);
    s.release = {
      wrist: { ...sample.wrist },
      ball: b ? { x: b.x, y: b.y, r: b.r } : null,
      elbowAngle: sample.elbowAngle,
      heightRatio: (sample.headTopY - sample.wrist.y) / sample.torso,
      wristVel: this.wristVelVec(t),
      skeleton: this.captureSkeleton(sample),
    };
    if (!s.setPoint) s.setPoint = this.captureSetPoint(sample);
    // Seed the flight trail with the release-point ball position.
    if (b) this.flight.push({ ...b, t });
  }

  captureSkeleton(sample) {
    return {
      wrist: { ...sample.wrist },
      elbow: { ...sample.elbowPt },
      shoulder: { ...sample.shoulderPt },
      guideWrist: { ...sample.guideWrist },
    };
  }

  latestBall(t, maxAgeMs) {
    const b = this.ballTrail[this.ballTrail.length - 1];
    return b && t - b.t <= maxAgeMs ? b : null;
  }

  ballRising(t) {
    const n = this.ballTrail.length;
    if (n < 2) return false;
    const b1 = this.ballTrail[n - 1], b0 = this.ballTrail[n - 2];
    return t - b1.t < 120 && b1.y < b0.y;
  }

  wristVelY(t, torso) {
    return this.wristVelVec(t).vy / torso;
  }

  // Wrist velocity in normalized units/sec over the last ~80ms.
  wristVelVec(t) {
    const n = this.samples.length;
    if (n < 2) return { vx: 0, vy: 0 };
    const cur = this.samples[n - 1];
    let past = null;
    for (let i = n - 2; i >= 0; i--) {
      if (t - this.samples[i].t >= 60) {
        past = this.samples[i];
        break;
      }
    }
    if (!past) past = this.samples[0];
    const dt = Math.max(1, cur.t - past.t) / 1000;
    return {
      vx: (cur.wrist.x - past.wrist.x) / dt,
      vy: (cur.wrist.y - past.wrist.y) / dt,
    };
  }

  // Release angle from ball flight (preferred) or wrist velocity (fallback).
  // aspect = videoWidth / videoHeight, needed because normalized units differ per axis.
  computeReleaseAngle(s, aspect) {
    const dir = s.facing;
    const pts = this.flight
      .filter((p) => p.t >= s.tRelease - 30)
      .map((p) => ({ x: p.x * aspect, y: p.y, t: p.t }));
    // Keep the monotonic (outbound) part of the flight.
    const out = [];
    for (const p of pts) {
      if (out.length === 0 || (p.x - out[out.length - 1].x) * dir > 0.001) out.push(p);
      if (out.length >= 14) break;
    }
    if (out.length >= T.minFlightPoints) {
      const span = Math.abs(out[out.length - 1].x - out[0].x);
      if (span > 0.04) {
        const fit = fitParabola(out);
        if (fit) {
          const slope = 2 * fit.a * out[0].x + fit.b;
          const deg = (Math.atan(-slope * dir) * 180) / Math.PI;
          if (deg > 5 && deg < 85) return { deg, source: "ball", fit, points: out };
        }
        // Fall back to a straight line through the first few points.
        const a = out[0], b = out[Math.min(3, out.length - 1)];
        const deg = (Math.atan2(-(b.y - a.y), (b.x - a.x) * dir) * 180) / Math.PI;
        if (deg > 5 && deg < 88) return { deg, source: "ball-linear", points: out };
      }
    }
    const v = s.release?.wristVel;
    if (v && (Math.abs(v.vx) > 0.01 || Math.abs(v.vy) > 0.01)) {
      const deg = (Math.atan2(-v.vy, v.vx * aspect * dir) * 180) / Math.PI;
      if (deg > 0 && deg < 90) return { deg, source: "wrist", points: [] };
      return { deg: null, source: "none", points: [] };
    }
    return { deg: null, source: "none", points: [] };
  }

  finalizeShot(t) {
    const s = this.shot;
    if (!s || !s.release) return;
    const aspect = this.videoAspect || 16 / 9;
    const rel = this.computeReleaseAngle(s, aspect);

    const metrics = {
      kneeBendDeg: Math.round(s.minKnee),
      dipToReleaseMs: s.tRelease != null && s.tDipBottom != null ? Math.round(s.tRelease - s.tDipBottom) : null,
      legLeadMs: s.tArmDrive && s.tLegDrive ? Math.round(s.tArmDrive - s.tLegDrive) : null,
      legsEarlyMs: s.tLegsDone && s.tRelease ? Math.round(s.tRelease - s.tLegsDone) : null,
      releaseAngleDeg: rel.deg != null ? Math.round(rel.deg) : null,
      releaseAngleSource: rel.source,
      releaseHeightRatio: +s.release.heightRatio.toFixed(2),
      releaseElbowDeg: Math.round(s.release.elbowAngle),
      setForearmVertDeg: s.setPoint ? Math.round(s.setPoint.forearmVertDeg) : null,
      elbowFlareDeg: s.setPoint && s.setPoint.elbowFlareDeg != null ? Math.round(s.setPoint.elbowFlareDeg) : null,
      followMaxElbowDeg: Math.round(s.followMaxElbow),
      followHoldMs: Math.round(s.followHoldMs),
      wristSnap: s.wristSnap,
      guideSepRatio: s.guideSepRatio != null ? +s.guideSepRatio.toFixed(2) : null,
      ballTracked: rel.source.startsWith("ball"),
    };

    const shot = {
      t,
      metrics,
      facing: s.facing,
      releasePoint: s.release.ball ?? s.release.wrist,
      skeleton: s.release.skeleton,
      // Full ball path around the shot, for the trace drawing (normalized).
      trail: this.ballTrail.filter((p) => p.t > s.tStart - 300 && p.t <= t),
      flight: this.flight.slice(),
      arcFit: rel.fit ?? null,
      arcPoints: rel.points ?? [],
    };
    this.lastShot = shot;
    if (this.onShot) this.onShot(shot);
  }
}

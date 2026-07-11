// Turns raw shot metrics into coaching feedback. Each rule returns
// { status: 'good' | 'warn' | 'bad' | 'na', text } and carries display
// metadata so the UI can render a meter with the good range marked.
//
// The good ranges encode standard shooting-coach fundamentals:
// - Legs: a real knee bend (roughly 100-140° at the deepest point) that
//   starts the shot, with the arm extending as (not before) the legs drive.
// - One motion: from the bottom of the dip to release in well under a second.
// - Set point & release: ball above the eyebrow at release, shooting-side
//   forearm close to vertical under the ball, elbow stacked (not flared).
// - Finish: full elbow extension, wrist snapped ("hand in the cookie jar"),
//   held for a beat; guide hand off the ball by release.

export const RULES = [
  {
    id: "kneeBend",
    label: "Knee bend",
    metric: "kneeBendDeg",
    unit: "°",
    scale: { min: 80, max: 180 },
    good: [100, 140],
    lowerIsBetter: null,
    eval(v) {
      if (v == null) return na();
      if (v > 155) return bad(`Barely any knee bend (${v}°). Power starts in the legs — sink into your hips before the ball goes up so your arm isn't doing all the work.`);
      if (v > 140) return warn(`Shallow knee bend (${v}°). A deeper, quicker dip will give you effortless range.`);
      if (v < 95) return warn(`Very deep knee bend (${v}°). Dropping that low slows your release — load quickly, don't squat.`);
      return good(`Good leg load (${v}° at the deepest point).`);
    },
  },
  {
    id: "legLead",
    label: "Legs → arm timing",
    metric: "legLeadMs",
    unit: " ms",
    scale: { min: -300, max: 500 },
    good: [0, 300],
    eval(v) {
      if (v == null) return na();
      if (v < -60) return bad(`Arm fires ${-v} ms before your legs drive. Sequence is legs first, then arm — let the lower body start the shot and the arm ride the wave.`);
      if (v > 350) return warn(`Long gap (${v} ms) between leg drive and arm extension — energy leaks away. Tighten it into one motion.`);
      return good(`Nice sequencing: legs lead the arm by ${v} ms.`);
    },
  },
  {
    id: "rhythm",
    label: "Dip → release time",
    metric: "dipToReleaseMs",
    unit: " ms",
    scale: { min: 200, max: 1600 },
    good: [300, 750],
    lowerIsBetter: true,
    eval(v) {
      if (v == null) return na();
      if (v > 1100) return bad(`Slow release: ${(v / 1000).toFixed(2)} s from dip to release. That's a two-motion shot — defenders will get to it. Work on going up in one continuous motion.`);
      if (v > 750) return warn(`${(v / 1000).toFixed(2)} s from dip to release — a touch slow. Smooth it into one motion.`);
      return good(`Quick, one-motion release (${(v / 1000).toFixed(2)} s).`);
    },
  },
  {
    id: "releaseAngle",
    label: "Release angle",
    metric: "releaseAngleDeg",
    unit: "°",
    scale: { min: 20, max: 80 },
    good: [45, 55],
    eval(v, m) {
      if (v == null) return na("Ball flight wasn't tracked — make sure the ball is visible against the background after release.");
      const src = m.releaseAngleSource === "wrist" ? " (estimated from wrist path)" : "";
      if (v < 40) return bad(`Flat release at ${v}°${src}. A flat shot has a tiny target window — aim for 45-55° so the ball drops into the rim.`);
      if (v < 45) return warn(`Slightly flat: ${v}°${src}. Add a bit more arc.`);
      if (v > 62) return warn(`Very high arc (${v}°${src}) — costs you consistency and range. Flatten it toward 50-55°.`);
      return good(`Great arc: ${v}° release angle${src}.`);
    },
  },
  {
    id: "releaseHeight",
    label: "Release height",
    metric: "releaseHeightRatio",
    unit: " torso",
    scale: { min: -0.8, max: 1.2 },
    good: [0, 0.7],
    eval(v) {
      if (v == null) return na();
      if (v < -0.3) return bad(`Low release — the ball leaves around chin height. That's a shot-put motion; raise your set point so you release above your forehead.`);
      if (v < 0) return warn(`Release is a little low (around eye level). Get it above your forehead for a cleaner sight line and harder contest.`);
      if (v > 0.85) return warn(`Very high release point. If it feels like a strain or slows your shot, bring the set point down a touch.`);
      return good(`Good high release point.`);
    },
  },
  {
    id: "underBall",
    label: "Forearm under ball",
    metric: "setForearmVertDeg",
    unit: "°",
    scale: { min: 0, max: 70 },
    good: [0, 30],
    lowerIsBetter: true,
    eval(v) {
      if (v == null) return na();
      if (v > 45) return bad(`Forearm is ${v}° off vertical at the set point — you're pushing the ball from behind instead of getting under it. Set the ball with your elbow beneath it and wrist loaded.`);
      if (v > 30) return warn(`Forearm ${v}° off vertical at the set point. Work on getting your hand more under the ball.`);
      return good(`Hand is under the ball at the set point (forearm ${v}° off vertical).`);
    },
  },
  {
    id: "elbow",
    label: "Elbow alignment",
    metric: "elbowFlareDeg",
    unit: "°",
    scale: { min: -20, max: 50 },
    good: [-10, 15],
    lowerIsBetter: true,
    eval(v) {
      if (v == null) return na();
      if (v > 28) return bad(`Elbow flaring out about ${v}°. Tuck it in — shoulder, elbow, wrist and rim should stack in one line, like shooting out of a phone booth.`);
      if (v > 15) return warn(`Elbow drifts out ~${v}°. Keep it under the ball.`);
      if (v < -12) return warn(`Elbow pinched ${-v}° across your body — that twists the shot. Keep the forearm relaxed and vertical.`);
      return good(`Elbow stays stacked under the ball.`);
    },
  },
  {
    id: "extension",
    label: "Follow-through extension",
    metric: "followMaxElbowDeg",
    unit: "°",
    scale: { min: 120, max: 185 },
    good: [160, 185],
    eval(v) {
      if (v == null) return na();
      if (v < 150) return bad(`Arm only reaches ${v}° — you're cutting the follow-through short. Snap the elbow to full extension and reach for the rim.`);
      if (v < 160) return warn(`Almost full extension (${v}°). Finish tall — full elbow lockout.`);
      return good(`Full extension on the follow-through (${v}°).`);
    },
  },
  {
    id: "wristSnap",
    label: "Wrist snap",
    metric: "wristSnap",
    unit: "",
    scale: null,
    good: null,
    eval(v) {
      if (v == null) return na();
      return v
        ? good(`Wrist snapped down — that's where your touch comes from.`)
        : warn(`No clear wrist snap detected. Finish with fingers pointing at the floor — "hand in the cookie jar".`);
    },
  },
  {
    id: "hold",
    label: "Follow-through hold",
    metric: "followHoldMs",
    unit: " ms",
    scale: { min: 0, max: 900 },
    good: [300, 900],
    eval(v) {
      if (v == null) return na();
      if (v < 150) return bad(`Follow-through drops immediately (${v} ms). Hold it until the ball hits the rim — it keeps the whole motion honest.`);
      if (v < 300) return warn(`Short follow-through hold (${v} ms). Hold your finish a beat longer.`);
      return good(`Held the follow-through (${(v / 1000).toFixed(1)} s).`);
    },
  },
  {
    id: "guideHand",
    label: "Guide hand",
    metric: "guideSepRatio",
    unit: " torso",
    scale: { min: 0, max: 1.2 },
    good: [0.3, 1.2],
    eval(v) {
      if (v == null) return na();
      if (v < 0.18) return bad(`Guide hand is still on the ball at release — it's steering your shot. The off hand is a passenger: it leaves the ball just before release, palm facing sideways.`);
      if (v < 0.3) return warn(`Guide hand stays close through release. Make sure it isn't adding a thumb-push.`);
      return good(`Guide hand comes off cleanly.`);
    },
  },
];

function good(text) { return { status: "good", text }; }
function warn(text) { return { status: "warn", text }; }
function bad(text) { return { status: "bad", text }; }
function na(text = "Not measured on this shot.") { return { status: "na", text }; }

const STATUS_RANK = { bad: 0, warn: 1, good: 2, na: 3 };

// Evaluate all rules against a shot's metrics.
// Returns [{id, label, status, text, value, unit, scale, good}], worst first.
export function coachShot(metrics) {
  const results = RULES.map((r) => {
    const value = metrics[r.metric];
    const res = r.eval(value, metrics);
    return {
      id: r.id, label: r.label, unit: r.unit,
      scale: r.scale, good: r.good,
      value, ...res,
    };
  });
  results.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  return results;
}

// One-liner for audio feedback: the most important fix, or praise.
export function topCue(feedback) {
  const worst = feedback.find((f) => f.status === "bad") || feedback.find((f) => f.status === "warn");
  if (!worst) return "Great shot. Same form every time.";
  // Strip parenthetical details for speech.
  return worst.text.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

// Session-level summary: recurring issues across recent shots.
export function sessionTrends(shots) {
  if (shots.length < 3) return [];
  const counts = new Map();
  for (const s of shots) {
    for (const f of s.feedback) {
      if (f.status === "bad" || f.status === "warn") {
        counts.set(f.label, (counts.get(f.label) || 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= Math.ceil(shots.length / 2))
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => ({ label, count: n, total: shots.length }));
}

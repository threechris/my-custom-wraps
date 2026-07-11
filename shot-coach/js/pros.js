// Reference form profiles for notable shooters, expressed in the same metrics
// the analyzer measures. Values are estimates compiled from published shot
// analyses, broadcast tracking data and coaching breakdowns — good enough to
// compare tendencies against, not laboratory ground truth.

export const PROS = {
  curry: {
    name: "Stephen Curry",
    blurb:
      "The one-motion archetype: a quick, shallow-but-fast dip, legs and arm working as a single wave, a high ~55° arc, and the ball released on the way up before the top of his jump. His guide hand leaves early and the follow-through is a full, held snap.",
    signature: [
      "Releases in ~0.4 s from the dip — among the fastest ever recorded",
      "High arc (~55°+) with entry angle near 46°",
      "One-motion: the ball never pauses at a set point",
    ],
    metrics: {
      kneeBendDeg: 125,
      legLeadMs: 80,
      dipToReleaseMs: 400,
      releaseAngleDeg: 55,
      releaseHeightRatio: 0.35,
      setForearmVertDeg: 15,
      elbowFlareDeg: 6,
      followMaxElbowDeg: 175,
      followHoldMs: 600,
      guideSepRatio: 0.55,
    },
  },
  klay: {
    name: "Klay Thompson",
    blurb:
      "The textbook catch-and-shoot: almost no dip, feet already set before the catch, a high fixed set point, perfectly stacked elbow, and minimal wasted motion. Klay's shot is efficient rather than explosive — everything is already aligned when the ball arrives.",
    signature: [
      "Minimal dip — the ball goes straight up from the catch",
      "High, repeatable set point with a square stance",
      "Elbow, wrist and rim in one vertical plane",
    ],
    metrics: {
      kneeBendDeg: 138,
      legLeadMs: 60,
      dipToReleaseMs: 500,
      releaseAngleDeg: 50,
      releaseHeightRatio: 0.55,
      setForearmVertDeg: 10,
      elbowFlareDeg: 3,
      followMaxElbowDeg: 178,
      followHoldMs: 500,
      guideSepRatio: 0.5,
    },
  },
  ray: {
    name: "Ray Allen",
    blurb:
      "Machine-like repetition: a deep, springy leg load, identical footwork every time, release at the peak of a quick jump, and a long, exaggerated follow-through held until the ball hits the net.",
    signature: [
      "Deep leg load powering an effortless, identical release",
      "~45-50° arc, release timed at the top of the jump",
      "Famous long, held follow-through",
    ],
    metrics: {
      kneeBendDeg: 115,
      legLeadMs: 100,
      dipToReleaseMs: 550,
      releaseAngleDeg: 48,
      releaseHeightRatio: 0.5,
      setForearmVertDeg: 12,
      elbowFlareDeg: 5,
      followMaxElbowDeg: 180,
      followHoldMs: 800,
      guideSepRatio: 0.6,
    },
  },
};

// Metrics worth showing in the comparison view, with display config.
export const COMPARE_METRICS = [
  { key: "dipToReleaseMs", label: "Dip → release", unit: "ms", min: 200, max: 1600 },
  { key: "releaseAngleDeg", label: "Release angle", unit: "°", min: 20, max: 80 },
  { key: "kneeBendDeg", label: "Knee bend", unit: "°", min: 80, max: 180 },
  { key: "releaseHeightRatio", label: "Release height", unit: "torso ↑head", min: -0.8, max: 1.2 },
  { key: "elbowFlareDeg", label: "Elbow flare", unit: "°", min: -20, max: 50 },
  { key: "setForearmVertDeg", label: "Forearm tilt @ set", unit: "°", min: 0, max: 70 },
  { key: "followHoldMs", label: "Follow-through hold", unit: "ms", min: 0, max: 900 },
];

// Average the numeric metrics over recent shots (nulls skipped per-metric).
export function averageMetrics(shots) {
  const out = {};
  for (const { key } of COMPARE_METRICS) {
    const vals = shots.map((s) => s.metrics[key]).filter((v) => v != null);
    out[key] = vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  }
  return out;
}

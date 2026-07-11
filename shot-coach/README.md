# 🏀 Shot Coach — basketball shooting form analyzer

A mobile web app that watches your jump shot through your phone's camera and
coaches your form in real time. Everything runs on-device in the browser —
no install, no account, no video ever leaves your phone.

## What it does

- **Automatic shot detection** — set your phone up side-on, shoot normally;
  each rep is detected from your body motion (load → rise → release →
  follow-through).
- **Ball trajectory trace** — tracks the ball by color, draws the arc over
  the video, fits the flight to a parabola and reports your **release angle**.
- **Form metrics per shot** — knee bend, legs→arm sequencing, dip-to-release
  time (one-motion vs two-motion), release height, forearm-under-ball at the
  set point, **elbow flare** (from 3D pose), follow-through extension, wrist
  snap, follow-through hold, and **guide-hand interference**.
- **Coaching feedback** — each metric is scored against coaching fundamentals
  with a plain-language cue ("elbow flaring out ~20° — tuck it in…"), plus
  optional spoken feedback after every shot so you don't have to walk to the
  phone.
- **Session tracking** — shot log, averages, and recurring focus areas across
  the session.
- **Pro comparison** — compare your averages against estimated form profiles
  for **Stephen Curry, Klay Thompson, and Ray Allen** (release angle, dip
  time, knee bend, release height, elbow alignment, follow-through).

## How to use it

1. Open the app **over https** (see hosting below) in Safari on iPhone
   (Chrome/Android works too).
2. Tap **Start session** and allow camera access.
3. Prop the phone up **side-on to your shooting arm**, ~10–15 ft away, so your
   **whole body (head to feet)** and the first part of the ball's flight are
   in frame. Landscape gives the ball more room.
4. Shoot. After each rep, check **Last shot** for the arc trace + feedback,
   **Session** for trends, and **Pros** to compare with Curry / Klay / Ray.

Tips for good tracking:

- Even light; avoid shooting straight into a bright window or low sun.
- A standard orange ball reads best (adjust *Ball color detection* in
  settings for dim gyms or worn balls).
- The **blue arm** in the overlay is the arm being analyzed — switch shooting
  hand in ⚙ settings if it picked the wrong one.
- The front camera works (that's the default so you can see the screen);
  the rear camera has better quality — tap ⟲ to flip if someone's filming
  or you don't need the screen.

## Hosting / running it

The camera API requires a **secure context (https)**, so the app must be
served — opening `index.html` from the filesystem won't work on a phone.

- **GitHub Pages** (easiest): enable Pages for this repo and open
  `https://<user>.github.io/<repo>/shot-coach/` on your phone.
- **Local dev**: `npx http-server shot-coach -p 8080` and open
  `http://localhost:8080` (localhost counts as secure on desktop; for a
  phone on your LAN you'll need https or a tunnel like `ngrok`).

The app is fully self-contained: MediaPipe's pose engine (`vendor/`) and both
pose models (`models/`) are checked in, so it works with no CDN and can be
saved to the home screen as a web app.

## How it works

| Piece | Approach |
|---|---|
| Body tracking | [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (WASM, GPU-accelerated), 33 landmarks incl. 3D world coordinates |
| Shot phases | State machine on joint angles + wrist velocity: idle → load (knee flex) → rise → release → follow-through |
| Release | Ball separating from the shooting hand (preferred) or elbow extension + wrist height (fallback) |
| Ball tracking | Orange-color blob detection on a downsampled frame, motion-gated during flight |
| Release angle | Parabola fit over post-release flight points; slope at the release point |
| Elbow flare | Angle of the upper arm off the shooting plane, from 3D world landmarks |
| Coaching | Rule engine in `js/coach.js` — ranges encode standard shooting fundamentals; every threshold is tunable |

## Honest limitations

- **Release angle needs the ball visible in flight.** Cluttered/orange
  backgrounds or dim light can drop ball tracking; the app falls back to a
  wrist-motion estimate and says so on the shot card.
- **Side view is required** for leg/arm timing and release metrics. Elbow
  flare is estimated from 3D pose and is the least precise metric —
  treat it as directional, not gospel.
- **Makes/misses aren't detected** (the rim usually isn't in frame at a
  useful scale). It coaches the *form*, not the result.
- **Pro profiles are estimates** compiled from public shot analyses and
  broadcast tracking data — a direction to compare against, not ground truth.
- Older iPhones (pre-A12) may run the pose model slowly; keep the *Fast*
  model selected in settings.

## Repo layout

```
shot-coach/
├── index.html              app shell
├── css/style.css           mobile-first dark UI
├── js/
│   ├── main.js             bootstrap, camera, render loop, settings
│   ├── poseEngine.js       MediaPipe Pose wrapper (GPU→CPU fallback)
│   ├── ballTracker.js      orange-blob ball detection
│   ├── shotAnalyzer.js     shot phase state machine + metrics
│   ├── coach.js            feedback rules engine
│   ├── pros.js             Curry / Klay / Ray Allen form profiles
│   ├── overlay.js          live skeleton/trace overlay + shot trace card
│   ├── ui.js               tabs, meters, session stats, pro comparison
│   └── geometry.js         angle/vector/parabola-fit helpers
├── models/                 pose models (lite + full), checked in
└── vendor/mediapipe/       @mediapipe/tasks-vision 0.10.14 (JS + WASM)
```

import { PoseEngine } from "./poseEngine.js";
import { BallTracker } from "./ballTracker.js";
import { ShotAnalyzer } from "./shotAnalyzer.js";
import { coachShot, topCue } from "./coach.js";
import { Overlay } from "./overlay.js";
import { UI } from "./ui.js";

const $ = (sel) => document.querySelector(sel);

const settings = loadSettings();

const state = {
  running: false,
  facingMode: settings.facingMode,
  stream: null,
  fps: 0,
  frames: 0,
  lastFpsT: 0,
  wakeLock: null,
};

const video = $("#cam");
const overlay = new Overlay($("#overlay"));
const ui = new UI();
const pose = new PoseEngine();
const balls = new BallTracker();
balls.setSensitivity(settings.ballSensitivity);

const analyzer = new ShotAnalyzer({
  shootingHand: settings.hand,
  onShot: (shot) => {
    shot.feedback = coachShot(shot.metrics);
    const aspect = video.videoWidth / video.videoHeight || 16 / 9;
    ui.addShot(shot, aspect);
    if (shot.metrics.releaseAngleDeg != null && shot.releasePoint) {
      overlay.showRelease(shot.releasePoint, shot.metrics.releaseAngleDeg, performance.now());
    }
    if (settings.voice) speak(topCue(shot.feedback));
    if (navigator.vibrate) navigator.vibrate(80);
  },
});

function loadSettings() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem("shotcoach-settings") || "{}");
  } catch { /* fresh start */ }
  return {
    hand: s.hand ?? "right",
    voice: s.voice ?? true,
    facingMode: s.facingMode ?? "user",
    ballSensitivity: s.ballSensitivity ?? 1,
    model: s.model ?? "lite",
    seenIntro: s.seenIntro ?? false,
  };
}

function saveSettings() {
  localStorage.setItem("shotcoach-settings", JSON.stringify(settings));
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* non-critical */ }
}

async function startCamera() {
  stopCamera();
  const constraints = {
    audio: false,
    video: {
      facingMode: state.facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  };
  state.stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = state.stream;
  await video.play();
  // Mirror only the selfie camera.
  const mirrored = state.facingMode === "user";
  $("#stage").classList.toggle("mirrored", mirrored);
  ui.mirrored = mirrored;
}

function stopCamera() {
  if (state.stream) {
    for (const t of state.stream.getTracks()) t.stop();
    state.stream = null;
  }
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      state.wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch { /* not critical */ }
}

function loop(now) {
  if (!state.running) return;
  requestAnimationFrame(loop);

  if (video.readyState < 2) return;
  overlay.resize(video.videoWidth, video.videoHeight);
  analyzer.videoAspect = video.videoWidth / video.videoHeight;

  const result = pose.detect(video, now);
  const ball = balls.detect(video, now, analyzer.ballHint());
  analyzer.update(now, result, ball);

  overlay.clear();
  if (result) overlay.drawSkeleton(result.landmarks, settings.hand);
  overlay.drawBall(ball);
  const tRel = analyzer.shot?.tRelease ?? analyzer.lastShot?.flight?.[0]?.t ?? null;
  overlay.drawTrail(analyzer.ballTrail, tRel, now);
  overlay.drawReleaseBadge(now);

  if (!result) {
    overlay.drawPhaseHint("Step into frame — full body, side-on");
  } else if (analyzer.framing === "partial") {
    overlay.drawPhaseHint("Back up — head to feet must be visible");
  }

  ui.updateLive(analyzer.live, state.fps);

  state.frames++;
  if (now - state.lastFpsT > 1000) {
    state.fps = state.frames;
    state.frames = 0;
    state.lastFpsT = now;
  }
}

async function start() {
  const btn = $("#start-btn");
  btn.disabled = true;
  try {
    ui.setStatus("Loading pose model…");
    if (!pose.landmarker) await pose.init(settings.model);
    ui.setStatus("Starting camera…");
    await startCamera();
    ui.setStatus("");
    $("#intro").classList.add("hidden");
    $("#stage-ui").classList.remove("hidden");
    state.running = true;
    state.lastFpsT = performance.now();
    requestWakeLock();
    if (settings.voice) speak("Coach is watching. Take your first shot.");
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    ui.setStatus(cameraErrorMessage(err));
    btn.disabled = false;
  }
}

function cameraErrorMessage(err) {
  if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
    return "Camera permission denied. Allow camera access in your browser settings (on iOS: aA menu → Website Settings → Camera → Allow), then reload.";
  }
  if (err && err.name === "NotFoundError") {
    return "No camera found on this device.";
  }
  if (!window.isSecureContext) {
    return "Camera needs a secure (https) page. Open this app via its https URL.";
  }
  return "Couldn't start: " + (err && err.message ? err.message : String(err));
}

function bindControls() {
  $("#start-btn").addEventListener("click", start);

  $("#flip-btn").addEventListener("click", async () => {
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    settings.facingMode = state.facingMode;
    saveSettings();
    try {
      await startCamera();
    } catch (e) {
      ui.setStatus(cameraErrorMessage(e));
    }
  });

  $("#settings-btn").addEventListener("click", () => {
    $("#settings").classList.toggle("hidden");
  });
  $("#settings-close").addEventListener("click", () => {
    $("#settings").classList.add("hidden");
  });

  const handSel = $("#set-hand");
  handSel.value = settings.hand;
  handSel.addEventListener("change", () => {
    settings.hand = handSel.value;
    analyzer.setShootingHand(settings.hand);
    saveSettings();
  });

  const voiceSel = $("#set-voice");
  voiceSel.checked = settings.voice;
  voiceSel.addEventListener("change", () => {
    settings.voice = voiceSel.checked;
    saveSettings();
  });

  const ballSel = $("#set-ball");
  ballSel.value = String(settings.ballSensitivity);
  ballSel.addEventListener("change", () => {
    settings.ballSensitivity = +ballSel.value;
    balls.setSensitivity(settings.ballSensitivity);
    saveSettings();
  });

  const modelSel = $("#set-model");
  modelSel.value = settings.model;
  modelSel.addEventListener("change", async () => {
    settings.model = modelSel.value;
    saveSettings();
    if (state.running) {
      ui.setStatus("Switching model…");
      pose.close();
      await pose.init(settings.model);
      ui.setStatus("");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.running) requestWakeLock();
  });
}

bindControls();

// Surface uncaught errors on-page (usable at the court, no devtools).
window.addEventListener("error", (e) => {
  ui.setStatus("Error: " + e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  ui.setStatus("Error: " + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

// Expose for debugging from the console.
window.__shotcoach = { analyzer, pose, balls, ui, state };

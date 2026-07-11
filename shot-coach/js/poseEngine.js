import { FilesetResolver, PoseLandmarker } from "../vendor/mediapipe/vision_bundle.mjs";

// MediaPipe Pose landmark indices.
export const LM = {
  NOSE: 0,
  LEFT_EYE: 2, RIGHT_EYE: 5,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT: 31, RIGHT_FOOT: 32,
};

export class PoseEngine {
  constructor() {
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.lastResult = null;
  }

  async init(model = "lite") {
    const fileset = await FilesetResolver.forVisionTasks("vendor/mediapipe/wasm");
    const options = (delegate) => ({
      baseOptions: {
        modelAssetPath: `models/pose_landmarker_${model}.task`,
        delegate,
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, options("GPU"));
    } catch (e) {
      console.warn("GPU delegate unavailable, falling back to CPU", e);
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, options("CPU"));
    }
  }

  // Returns {landmarks, worldLandmarks} for the first detected person, or null.
  // Safe to call every rAF; skips duplicate video frames.
  detect(video, nowMs) {
    if (!this.landmarker || video.readyState < 2) return this.lastResult;
    if (video.currentTime === this.lastVideoTime) return this.lastResult;
    this.lastVideoTime = video.currentTime;
    const res = this.landmarker.detectForVideo(video, nowMs);
    if (res && res.landmarks && res.landmarks.length > 0) {
      this.lastResult = {
        landmarks: res.landmarks[0],
        world: res.worldLandmarks ? res.worldLandmarks[0] : null,
        t: nowMs,
      };
    } else {
      this.lastResult = null;
    }
    return this.lastResult;
  }

  close() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}

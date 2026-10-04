/**
 * config.js — app-wide constants.
 * Exercise metadata lives here; the per-exercise logic lives in js/exercises/.
 */

// MediaPipe Pose landmark indices (same 33 points as the Python version).
export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_PINKY: 17,    RIGHT_PINKY: 18,
  LEFT_INDEX: 19,    RIGHT_INDEX: 20,
  LEFT_THUMB: 21,    RIGHT_THUMB: 22,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,     RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

// Skeleton edges for drawing (index pairs).
export const POSE_EDGES = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],
  [27,29],[29,31],[28,30],[30,32],
];

export const EXERCISES = ["Squat", "Push-up", "Plank", "Lunge", "Jumping Jack"];

// What a good rep looks like — shown beside the animated demo on the setup screen.
export const DEMO_TIPS = {
  "Squat":        ["Stand side-on with your whole body in frame", "Sit back until your thighs reach parallel", "Keep your chest up: lean under about 30°"],
  "Push-up":      ["Side-on, camera at floor height", "Lower until your elbows reach about 90°", "Shoulders, hips and ankles in one line"],
  "Plank":        ["Side-on, camera at floor height", "Hands or forearms under your shoulders", "Hips level: no sag, no pike"],
  "Lunge":        ["Side-on, then step forward", "Drop until your front knee is about 90°", "Keep your torso tall"],
  "Jumping Jack": ["Face the camera", "Hands all the way overhead", "Feet out wider than your shoulders"],
};

export const EXERCISE_META = {
  "Squat":        { icon: "🦵", hint: "Stand side-on. Slow, controlled reps.",  live: true  },
  "Push-up":      { icon: "💪", hint: "Side-on to the camera.",                 live: true  },
  "Plank":        { icon: "🧘", hint: "Side-on. Hold the position.",            live: true  },
  "Lunge":        { icon: "🏃", hint: "Side-on. Step and hold.",                live: true  },
  "Jumping Jack": { icon: "⭐", hint: "Face the camera.",                       live: true  },
};

// Visibility below this and we don't trust a measurement.
export const VIS_THRESHOLD = 0.5;

// A rep must spend at least this many frames in the "deep" zone to count,
// which stops a single glitchy frame from registering as a rep.
export const MIN_DEEP_FRAMES = 4;

export const DEFAULTS = {
  target: 90,
  goal: 1,          // 0 = endless
  countdown: 3,
  personality: "Chill",
  voice: true,
  mirror: true,
  setReps: 5,       // "Analyze a set" length: reps (plank: × 6 seconds)
  quality: "auto",  // pose model: auto | lite | full | heavy (js/pose.js)
  startMode: "countdown",  // countdown | auto (start once you hold the start position still)
  chattiness: "normal",    // quiet (score only) | normal | detailed (trends, fuller summary)
  tempo: "off",            // off | beep | voice ("down… 2… up")
  voiceRate: 1.05,         // speech speed
  volume: 1,               // voice + beeps, 0..1
  gymMode: false,          // huge rep counter on the live screen
  facing: null,            // phones: "user" (front) | "environment" (back); null = pick a camera by name
  restSeconds: 60,         // rest timer between sets: 30 | 60 | 90
  onboarded: false,        // first-run setup tips seen
};

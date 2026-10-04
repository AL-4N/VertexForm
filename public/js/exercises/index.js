/** index.js — exercise registry. Add a new exercise by importing it here. */

import squat from "./squat.js";
import pushup from "./pushup.js";
import plank from "./plank.js";
import lunge from "./lunge.js";
import jumpingjack from "./jumpingjack.js";

export const REGISTRY = {
  "Squat": squat,
  "Push-up": pushup,
  "Plank": plank,
  "Lunge": lunge,
  "Jumping Jack": jumpingjack,
};

export const getExercise = (name) => REGISTRY[name];

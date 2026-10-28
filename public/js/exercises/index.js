/** index.js — exercise registry. Add a new exercise by importing it here. */

import squat from "./squat.js";
import pushup from "./pushup.js";
import plank from "./plank.js";
import lunge from "./lunge.js";
import jumpingjack from "./jumpingjack.js";
import pike from "./pike.js";
import sideplank from "./sideplank.js";
import hollow from "./hollow.js";
import climber from "./climber.js";
import hang from "./hang.js";

export const REGISTRY = {
  "Squat": squat,
  "Push-up": pushup,
  "Plank": plank,
  "Lunge": lunge,
  "Jumping Jack": jumpingjack,
  "Pike push-up": pike,
  "Side plank": sideplank,
  "Hollow hold": hollow,
  "Mountain climber": climber,
  "Dead hang": hang,
};

export const getExercise = (name) => REGISTRY[name];

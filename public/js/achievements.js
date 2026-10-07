/**
 * achievements.js — unlockables, persisted in localStorage.
 */

import { store, save, globalAverage, dayStreak } from "./storage.js";
import { toast } from "./ui/components.js";
import { beep } from "./voice.js";
import { REGISTRY } from "./exercises/index.js";
import { newSkills, skillName } from "./skills.js";

export const ACHIEVEMENTS = [
  { id: "first_rep",  title: "Getting Started", desc: "Complete your first rep" },
  { id: "first_a",    title: "A-Player",        desc: "Score 90+ on a rep" },
  { id: "perfect",    title: "Perfection",      desc: "Hit a perfect 100" },
  { id: "hot_streak", title: "Hot Streak",      desc: "3 good reps in a row" },
  { id: "ten_good",   title: "Consistent",      desc: "10 total 90+ reps" },
  { id: "grinder",    title: "Grinder",         desc: "50 total reps recorded" },
  { id: "all_five",   title: "Explorer",        desc: "Try every exercise" },
  { id: "avg_80",     title: "Elite Form",      desc: "Average of 80+ over 5+ sessions" },
  { id: "streak_3",   title: "On a Roll",       desc: "Train 3 days in a row" },
  { id: "streak_7",   title: "Habit Formed",    desc: "Train 7 days in a row" },
];

function unlock(id) {
  if (store.unlocked.includes(id)) return false;
  store.unlocked.push(id);
  save();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  toast(`Achievement unlocked: ${a?.title ?? id}`);
  beep(880, 150, 0.06);
  return true;
}

/** Call after each rep with its score. */
export function checkRep(score) {
  unlock("first_rep");
  if (score >= 90) unlock("first_a");
  if (score >= 100) unlock("perfect");
  if (store.stats.goodReps >= 10) unlock("ten_good");
  if (store.stats.totalReps >= 50) unlock("grinder");
}

export function checkStreak(streak) {
  if (streak >= 3) unlock("hot_streak");
}

export function checkSession() {
  if (new Set(store.stats.tried).size >= Object.keys(REGISTRY).length) unlock("all_five");
  const g = globalAverage();
  const sessions = Object.values(store.history).flat().length;
  if (g !== null && g >= 80 && sessions >= 5) unlock("avg_80");
  const streak = dayStreak();
  if (streak >= 3) unlock("streak_3");
  if (streak >= 7) unlock("streak_7");
  checkSkills();
}

/** Unlock any skill-path steps the saved sets now reach. */
export function checkSkills() {
  const fresh = newSkills(store.sessions, store.skills);
  if (!fresh.length) return;
  store.skills.push(...fresh);
  save();
  for (const id of fresh) toast(`Skill unlocked: ${skillName(id)}`);
  beep(988, 180, 0.06);
}

export const isUnlocked = (id) => store.unlocked.includes(id);

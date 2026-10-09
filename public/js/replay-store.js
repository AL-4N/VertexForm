/**
 * replay-store.js — where rep replays (js/repclips.js) are kept: IndexedDB,
 * in this browser only, like everything else. localStorage is too small
 * for them (a set's clips are ~100 KB).
 *
 * If IndexedDB isn't available (some private windows), clips live in
 * memory for this visit and nothing breaks.
 */

import { expiredIds } from "./repclips.js";

const DB = "vertexform", STORE = "replays", VERSION = 1;
let dbp = null;
const memory = new Map();

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await open();
  if (!db) return fn(null);
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** Every clip, newest set first, reps in order. */
export async function allClips() {
  const list = await tx("readonly", (s) => (s ? req(s.getAll()) : [...memory.values()]));
  return list.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.index - b.index);
}

export async function putClips(clips) {
  if (!clips.length) return;
  await tx("readwrite", (s) => { for (const c of clips) s ? s.put(c) : memory.set(c.id, c); });
}

export async function setSaved(id, saved) {
  await tx("readwrite", async (s) => {
    const c = s ? await req(s.get(id)) : memory.get(id);
    if (!c) return;
    c.saved = saved;
    s ? s.put(c) : memory.set(id, c);
  });
}

export async function removeClip(id) {
  await tx("readwrite", (s) => { s ? s.delete(id) : memory.delete(id); });
}

export async function removeAll() {
  await tx("readwrite", (s) => { s ? s.clear() : memory.clear(); });
}

/** Delete unsaved clips past their time, for good. Returns how many went. */
export async function purgeExpired(now = Date.now()) {
  const ids = expiredIds(await allClips(), now);
  if (ids.length) await tx("readwrite", (s) => { for (const id of ids) s ? s.delete(id) : memory.delete(id); });
  return ids.length;
}

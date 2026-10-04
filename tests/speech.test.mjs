/**
 * speech.test.mjs — the speech queue (js/speech.js): one line at a time,
 * only at a good moment, priorities, no pile-ups. Uses a fake voice and a
 * fake clock. Run with:  npm test
 */
import { SpeechQueue } from "../public/js/speech.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(54)} ${detail}`);
};

function setup() {
  let now = 0;
  const said = [];
  const voice = { busy: false, speak(t) { said.push(t); this.busy = true; }, cancel() { this.busy = false; said.push("<cancel>"); }, speaking() { return this.busy; } };
  const q = new SpeechQueue(voice, { now: () => now });
  return { q, voice, said, advance: (ms) => { now += ms; }, done: () => { voice.busy = false; } };
}

{
  const { q, said, done } = setup();
  q.say("one"); q.say("two");
  q.tick(true); q.tick(true);
  check("One line at a time: never talks over itself", said.join() === "one", said.join());
  done(); q.tick(true);
  check("Next line once the first has finished", said.join() === "one,two", said.join());
}
{
  const { q, said } = setup();
  q.say("Go lower");
  q.tick(false);
  check("Mid-rep (canSpeak false): coaching waits", said.length === 0);
  q.tick(true);
  check("At the top: it's said", said.join() === "Go lower");
}
{
  const { q, said } = setup();
  q.say("Step back", { anytime: true });
  q.tick(false);
  check("Setup cues ('anytime') don't wait for the top", said.join() === "Step back");
}
{
  const { q, said } = setup();
  q.say("trend", { priority: 1 }); q.say("rep cue", { priority: 3 });
  q.tick(true);
  check("Higher priority first", said[0] === "rep cue", said.join());
}
{
  const { q, said } = setup();
  q.say("85. Go lower", { key: "rep" }); q.say("88. Chest up", { key: "rep" });
  q.tick(true);
  check("A newer rep line replaces one still waiting", said.join() === "88. Chest up" && q.pending.length === 0, said.join());
}
{
  const { q, said, advance } = setup();
  q.say("old news", { maxAgeMs: 3000 });
  advance(3500); q.tick(true);
  check("Stale lines expire instead of piling up", said.length === 0);
}
{
  const { q } = setup();
  for (let i = 0; i < 6; i++) q.say(`line ${i}`, { priority: i === 2 ? 5 : 1 });
  check("Queue never holds more than 3 lines", q.pending.length === 3, q.pending.join(" | "));
  check("...and keeps the most important", q.pending.includes("line 2"));
}
{
  const { q, said, voice } = setup();
  q.say("cue", { priority: 1 }); q.tick(true);
  q.say("trend", { priority: 1 });
  q.say("Set complete", { interrupt: true, priority: 5 });
  check("Interrupt cuts in now and drops less important lines", said.join() === "cue,<cancel>,Set complete" && q.pending.length === 0, said.join());
  check("...and is speaking", voice.busy);
}
{
  const { q, said, done, advance } = setup();
  q.say("Chest up"); q.tick(true); done();
  advance(1000); q.say("Chest up"); q.tick(true);
  check("The same sentence twice within 4 s is skipped", said.join() === "Chest up");
  done(); advance(5000); q.say("Chest up"); q.tick(true);
  check("...but can come back later", said.join() === "Chest up,Chest up");
}
{
  const { q, said } = setup();
  q.enabled = false; q.say("hello"); q.tick(true);
  check("Voice off: nothing queued or said", said.length === 0 && q.pending.length === 0);
}

console.log(`\n${fail ? `${fail} speech check(s) FAILED` : "All speech checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);

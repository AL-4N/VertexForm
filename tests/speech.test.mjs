/**
 * speech.test.mjs — the speech queue (js/speech.js): one line at a time,
 * only at a good moment, priorities, no pile-ups. Uses a fake voice and a
 * fake clock. Run with:  npm test
 */
import { SpeechQueue, planLine, PAUSE, partKey } from "../public/js/speech.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(54)} ${detail}`);
};

function setup() {
  let now = 0;
  const said = [];
  const voice = { busy: false, speak(item) { said.push(item.text); this.parts = item.parts; this.busy = true; }, cancel() { this.busy = false; said.push("<cancel>"); }, speaking() { return this.busy; } };
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

{
  const { q, said, voice } = setup();
  q.say([92, "Nice."], { priority: 2 }); q.tick(true);
  check("Parts: a score and a phrase go out as one line", said[0] === "92. Nice." && voice.parts[0] === 92);
}
{
  const { q, said, done } = setup();
  q.say("Rep 1: go lower", { key: "rep" }); q.say("Trend", { key: "trend" });
  q.drop("rep");                                    // rep 2 has started: rep 1's cue is stale
  q.tick(true); done(); q.tick(true);
  check("Stale rep feedback is dropped when a new rep starts", said.join() === "Trend", said.join());
}

{
  const { q, said, done, advance } = setup();
  q.say("Test", { interrupt: true, priority: 5 }); done(); advance(500);
  q.say("Test", { interrupt: true, priority: 5 });
  check("An interrupting line is said again even if just said", said.filter((x) => x === "Test").length === 2, said.join());
}

console.log("\nPause timing");
{
  const { starts, total } = planLine([92, "Better, that one hit parallel.", "Go lower"], [600, 1500, 900]);
  check(`~${PAUSE.afterNumber} ms after the score`, starts[1] - 600 === PAUSE.afterNumber, JSON.stringify(starts));
  check(`~${PAUSE.betweenSentences} ms between sentences`, starts[2] - (starts[1] + 1500) === PAUSE.betweenSentences);
  check("Total length adds up", total === 600 + 250 + 1500 + 400 + 900);
  const avg = planLine(["Set complete.", "Average", 87], [900, 500, 600]);
  check(`A label before a number: a short ${PAUSE.beforeNumber} ms`, avg.starts[2] - (avg.starts[1] + 500) === PAUSE.beforeNumber);
  check("Faster pace shortens the pauses, not the words", planLine([1, "a"], [100, 100], 2).starts[1] === 100 + PAUSE.afterNumber / 2);
  check("Numbers map to their recording keys", partKey(92) === "#92" && partKey("Nice.") === "Nice.");
}

console.log(`\n${fail ? `${fail} speech check(s) FAILED` : "All speech checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);

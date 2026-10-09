/**
 * index.js — the VertexForm Worker on Cloudflare.
 *
 * Everything is static files from public/, served by Cloudflare's asset
 * handling. The one exception is POST /api/coach-summary: the opt-in AI
 * coach summary. It's the only thing that ever calls a server, and it only
 * receives a few numbers about your week (public/js/weekly.js), never video.
 *
 * Setup (once, in the Cloudflare dashboard): Workers & Pages → vertexform →
 * Settings → Variables and Secrets → add a Secret named ANTHROPIC_API_KEY.
 * Without it the endpoint answers 503 and the app says the coach isn't set up.
 *
 * Optional: a rate-limit binding named COACH_LIMIT (see README) caps how
 * often one visitor can ask; without it, requests aren't rate limited.
 */

import { MAX_BODY, cleanWeek, requestBody, readReply } from "./coach.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});

async function coachSummary(request, env) {
  if (request.method !== "POST") return json({ error: "method" }, 405);
  // Only this site's own pages may ask (stops other sites spending the key).
  let sameSite = false;
  try { sameSite = new URL(request.headers.get("Origin")).host === new URL(request.url).host; } catch { /* no or bad Origin */ }
  if (!sameSite) return json({ error: "origin" }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not-configured" }, 503);

  if (env.COACH_LIMIT) {
    const { success } = await env.COACH_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "anon" });
    if (!success) return json({ error: "rate-limited" }, 429);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "too-big" }, 413);
  let week;
  try { week = cleanWeek(JSON.parse(raw)); } catch { week = null; }
  if (!week) return json({ error: "bad-data" }, 400);

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify(requestBody(week)),
    });
  } catch {
    return json({ error: "upstream" }, 502);
  }
  if (res.status === 429) return json({ error: "rate-limited" }, 429);
  if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
  const reply = readReply(await res.json());
  return reply.text ? json({ text: reply.text }) : json({ error: reply.error }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/coach-summary") return coachSummary(request, env);
    return env.ASSETS.fetch(request);
  },
};

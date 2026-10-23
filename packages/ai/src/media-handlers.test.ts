import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PodcastManifest, ReelsManifest } from "@nauka/shared";
import { UsageMeter } from "./cost.js";
import { mediaConfig } from "./media/config.js";
import { TtsError } from "./media/elevenlabs.js";
import { MediaError } from "./media/errors.js";
import { buildMeMedia, handleChapterRequest, handleFoxRequest, handlePodcastRequest, handleReelsRequest, RpcMissingError, type MediaRequestEnv } from "./media/handlers.js";
import type { MediaAi } from "./media/ai.js";
import { OTHER, SUBJECT, TOPIC, USER, chapterOut, exampleStoryboardOut, fakeAi, fakeDb, fakeTts, mediaRow, outlineOut, planOut, type AiHandler, type FakeDb } from "./media-fixtures.test-helper.js";

const quiet = { info() {}, warn() {}, error() {} };
const FULL_ENV = { ANTHROPIC_API_KEY: "sk-ant-test", ELEVENLABS_API_KEY: "el-test", ELEVENLABS_VOICE_FOX: "fox", ELEVENLABS_VOICE_SZOP: "szop" };

function harness(o: { db?: FakeDb; body?: unknown; env?: Record<string, string>; ai?: AiHandler; tts?: ReturnType<typeof fakeTts>; auth?: boolean; serverReady?: boolean; deadlineMs?: number } = {}) {
  const db = o.db ?? fakeDb();
  const jobs: (() => Promise<void>)[] = [];
  let authCalls = 0;
  const ai = fakeAi(o.ai ?? ((req) => (req.label === "reels plan" ? planOut(["czym", "kto", "mit"]) : exampleStoryboardOut())));
  const tts = o.tts ?? fakeTts();
  const env: MediaRequestEnv = {
    config: mediaConfig(o.env ?? FULL_ENV),
    serverReady: o.serverReady ?? true,
    body: o.body,
    startedAt: Date.now(),
    authenticate: async () => {
      authCalls++;
      return o.auth === false ? null : { userId: USER, db };
    },
    after: (job) => void jobs.push(job),
    makeAi: (_: { model: string; meter: UsageMeter }) => ai as MediaAi,
    tts,
    log: quiet,
    deadlineMs: o.deadlineMs,
  };
  return { env, db, jobs, ai, tts, auth: () => authCalls, run: async () => Promise.all(jobs.map((j) => j())) };
}
const reelsBody = (over: Record<string, unknown> = {}) => ({ requestId: randomUUID(), topicId: TOPIC, types: ["czym", "kto", "mit"], ...over });

/* ------------------------------------------------------------------------------------------------- reels */

test("reels: config checks come first (no_config → ai_unavailable → tts_unavailable), then 401, then 400 — all charged: false, no reserve", async () => {
  const cases: [Parameters<typeof harness>[0], number, string][] = [
    [{ serverReady: false }, 503, "no_config"],
    [{ env: { ELEVENLABS_API_KEY: "x" } }, 503, "ai_unavailable"],
    [{ env: { ANTHROPIC_API_KEY: "x" } }, 503, "tts_unavailable"],
    [{ auth: false, body: reelsBody() }, 401, "unauthorized"],
    [{ body: { requestId: "nie-uuid", topicId: TOPIC, types: ["czym"] } }, 400, "bad_request"],
    [{ body: reelsBody({ types: ["czym", "czym", "kto"] }) }, 400, "bad_request"],
    [{ body: reelsBody({ types: ["czym", "kto"] }) }, 400, "bad_request"],
    [{ body: reelsBody({ focusPointId: "p3" }) }, 400, "bad_request"],
    [{ body: reelsBody({ types: ["czym", "kto", "mit", "porownanie", "pulapki", "sprawdzian", "x"] }) }, 400, "bad_request"],
  ];
  for (const [o, status, code] of cases) {
    const h = harness(o);
    const res = await handleReelsRequest(h.env);
    assert.equal(res.status, status, code);
    assert.equal(res.body.code, code);
    assert.equal(res.body.charged, false);
    assert.ok(!h.db.log.some((l) => l.startsWith("reserve")), `${code}: nothing reserved`);
  }
  const noKey = harness({ env: { ELEVENLABS_API_KEY: "x" } });
  await handleReelsRequest(noKey.env);
  assert.equal(noKey.auth(), 0, "config checks before auth");
});

test("reels: idempotent requestId → 200 with the row, no reserve, no job; another account's id → 409 conflict", async () => {
  const db = fakeDb();
  const id = randomUUID();
  db.rows.set(id, mediaRow({ id, kind: "reels" }));
  const h = harness({ db, body: reelsBody({ requestId: id }) });
  const res = await handleReelsRequest(h.env);
  assert.equal(res.status, 200);
  assert.equal((res.body.media as { id: string }).id, id);
  assert.ok(!db.log.some((l) => l.startsWith("reserve")));
  assert.equal(h.jobs.length, 0);
  db.rows.set(id, mediaRow({ id, kind: "reels", owner_id: OTHER }));
  assert.equal((await handleReelsRequest(harness({ db, body: reelsBody({ requestId: id }) }).env)).body.code, "conflict");
});

test("reels: not_found (topic not owned), no_quiz, bad_point — before the charge", async () => {
  assert.equal((await handleReelsRequest(harness({ body: reelsBody({ topicId: randomUUID() }) }).env)).body.code, "not_found");
  const db = fakeDb();
  db.topics.set(TOPIC, { id: TOPIC, subjectId: SUBJECT, name: "x", stage: "liceum", content: { name: "x", levels: [{ id: "l1", title: "L", feed: [], flashcards: [], quiz: [] }] } });
  const h = harness({ db, body: reelsBody() });
  assert.equal((await handleReelsRequest(h.env)).body.code, "no_quiz");
  const bp = harness({ body: reelsBody({ types: ["mit"], focusPointId: "p42" }) });
  assert.equal((await handleReelsRequest(bp.env)).body.code, "bad_point");
  assert.ok(!bp.db.log.some((l) => l.startsWith("reserve")));
});

test("reels: busy / limit (lifetime, month) / daily / global / RPC missing / DB error → HTTP answers with charged: false", async () => {
  const map: [unknown, number, Record<string, unknown>][] = [
    [{ ok: false, reason: "busy", busy: { id: "m0", kind: "podcast", topicId: TOPIC } }, 409, { code: "busy", busy: { id: "m0", kind: "podcast", topicId: TOPIC } }],
    [{ ok: false, reason: "lifetime", used: 3, limit: 3 }, 402, { code: "limit_reached", reason: "lifetime", scope: "lifetime", used: 3, limit: 3 }],
    [{ ok: false, reason: "month", used: 30, limit: 30 }, 402, { code: "limit_reached", reason: "month", scope: "month", used: 30, limit: 30 }],
    [{ ok: false, reason: "daily", limit: 5 }, 402, { code: "limit_reached", reason: "daily" }],
    [{ ok: false, reason: "global" }, 402, { code: "limit_reached", reason: "global" }],
  ];
  for (const [answer, status, expect] of map) {
    const db = fakeDb({ reserveWith: () => answer as never });
    const h = harness({ db, body: reelsBody() });
    const res = await handleReelsRequest(h.env);
    assert.equal(res.status, status);
    for (const [k, v] of Object.entries(expect)) assert.deepEqual(res.body[k], v, `${JSON.stringify(answer)} → ${k}`);
    assert.equal(res.body.charged, false);
    assert.equal(h.jobs.length, 0);
    assert.doesNotMatch(String(res.body.error), /płat|cen[ay]|pro\b|kup|subskryp/i, "neutral copy");
  }
  const missing = harness({ db: fakeDb({ reserveWith: () => Promise.reject(new RpcMissingError("reserve_media: Could not find the function")) }), body: reelsBody() });
  assert.deepEqual([(await handleReelsRequest(missing.env)).status, (await handleReelsRequest(missing.env)).body.code], [503, "media_unavailable"]);
  const broken = harness({ db: fakeDb({ reserveWith: () => Promise.reject(new Error("connection reset")) }), body: reelsBody() });
  assert.equal((await handleReelsRequest(broken.env)).body.code, "reserve_failed");
});

test("reels: 202 with the running row; the job in after() writes files and finishes the row with manifest and stats", async () => {
  const h = harness({ body: reelsBody() });
  const res = await handleReelsRequest(h.env);
  assert.equal(res.status, 202);
  const media = res.body.media as { id: string; status: string; progress: unknown };
  assert.equal(media.status, "running");
  assert.deepEqual(media.progress, { step: "plan", done: 0, total: 3 });
  assert.equal(h.jobs.length, 1, "work scheduled with after()");
  assert.ok(!h.db.log.includes("finish"), "not finished before after()");
  await h.run();
  assert.equal(h.db.finished.length, 1);
  const m = h.db.finished[0]!.manifest as ReelsManifest;
  assert.equal(m.reels.length, 3);
  assert.equal(h.db.finished[0]!.stats.model, "claude-sonnet-5");
  assert.ok(h.db.finished[0]!.stats.tts_chars > 0);
  assert.ok([...h.db.files.keys()].every((p) => p.startsWith(`${USER}/${media.id}/`)));
  assert.equal(h.db.released.length + h.db.failed.length, 0);
});

test("reels job failures: AI unavailable → release (refund) and files removed; refusal → fail (charged); TTS 401 → release tts_unavailable; deadline → release timeout", async () => {
  {
    const h = harness({ body: reelsBody(), ai: () => { throw new MediaError("ai_unavailable", "401 authentication_error"); } });
    await handleReelsRequest(h.env);
    await h.run();
    assert.equal(h.db.released.length, 1);
    assert.match(h.db.released[0]!.reason, /^ai_unavailable:/);
    assert.equal(h.db.failed.length, 0);
  }
  {
    const h = harness({ body: reelsBody(), ai: (req) => { if (req.label === "reels plan") return planOut(["czym", "kto", "mit"]); throw new MediaError("refusal", "stop_reason refusal"); } });
    await handleReelsRequest(h.env);
    await h.run();
    assert.equal(h.db.failed.length, 1);
    assert.match(h.db.failed[0]!.reason, /^refusal:/);
    assert.equal(h.db.released.length, 0, "a refusal is not refunded");
  }
  {
    const tts = fakeTts((_r, call) => { if (call === 2) throw new TtsError("tts_unavailable", "401 invalid_api_key", 401); });
    const h = harness({ body: reelsBody(), tts });
    await handleReelsRequest(h.env);
    await h.run();
    assert.equal(h.db.released.length, 1);
    assert.match(h.db.released[0]!.reason, /^tts_unavailable:/);
    assert.ok(h.db.log.some((l) => l.startsWith("remove")), "partial files removed");
    assert.ok(h.db.released[0]!.stats.tts_chars > 0, "spent characters reported");
  }
  {
    const h = harness({ body: reelsBody(), deadlineMs: 50, ai: (req) => new Promise((_, reject) => req.signal.addEventListener("abort", () => reject(new MediaError("timeout", "aborted")))) });
    await handleReelsRequest(h.env);
    await h.run();
    assert.equal(h.db.released.length, 1);
    assert.match(h.db.released[0]!.reason, /^timeout:/);
  }
  {
    // the refund RPC refuses → the row is still closed (fail), never left running
    const db = fakeDb({ release: async () => false });
    const h = harness({ db, body: reelsBody(), ai: () => { throw new MediaError("invalid_output", "x"); } });
    await handleReelsRequest(h.env);
    await h.run();
    assert.equal(db.failed.length, 1);
  }
});

test("reels: the global TTS budget is asked before each reel (review F3) — reserved characters are reported as tts_logged; over the budget → that reel dropped; too few left → release tts_budget", async () => {
  {
    const h = harness({ body: reelsBody() });
    await handleReelsRequest(h.env);
    await h.run();
    const st = h.db.finished[0]!.stats;
    assert.equal(h.db.budgeted.length, 3, "one budget check per reel");
    assert.equal(st.tts_logged, h.db.budgeted.reduce((a, b) => a + b, 0), "reserved characters reported");
    assert.equal(st.tts_logged, st.tts_chars, "nothing synthesized outside the budget");
  }
  {
    const db = fakeDb();
    db.budgetSeq = [true, false, true];
    const h = harness({ db, body: reelsBody() });
    await handleReelsRequest(h.env);
    await h.run();
    assert.equal(h.tts.calls.length, 2, "the refused reel never reached the TTS");
    assert.equal(db.released.length, 1, "3 reels needed, 2 left → refund");
    assert.match(db.released[0]!.reason, /^tts_budget:/);
    assert.equal(db.released[0]!.stats.tts_logged, db.released[0]!.stats.tts_chars, "only reserved characters were spent");
  }
});

test("reels: the material deleted during the job (review F1) — finish refused → files removed and the creation released (refund by the ledger)", async () => {
  const db = fakeDb();
  db.finishOk = false;
  const h = harness({ db, body: reelsBody() });
  await handleReelsRequest(h.env);
  await h.run();
  assert.equal(db.finished.length, 1);
  assert.ok(db.log.some((l) => l.startsWith("remove")), "files removed");
  assert.equal(db.files.size, 0, "nothing left in Storage");
  assert.equal(db.released.length, 1, "refund requested");
  assert.match(db.released[0]!.reason, /^not_finished:/);
});

/* ----------------------------------------------------------------------------------------------- podcast */

test("podcast: voices_missing before auth (503, charged: false); then 202 and the script job finishes with a manifest", async () => {
  const noVoices = harness({ env: { ANTHROPIC_API_KEY: "x", ELEVENLABS_API_KEY: "y", ELEVENLABS_VOICE_FOX: "fox" }, body: { requestId: randomUUID(), topicId: TOPIC } });
  const r = await handlePodcastRequest(noVoices.env);
  assert.deepEqual([r.status, r.body.code, r.body.charged], [503, "voices_missing", false]);
  assert.equal(noVoices.auth(), 0);
  const outline = outlineOut(6, (i) => [`p${(i % 5) + 1}`]);
  outline.chapters.forEach((c, i) => {
    c.levels = [`l${(i % 3) + 1}`];
    c.quiz = `l${(i % 3) + 1}#q${i % 5}`;
  });
  const h = harness({ body: { requestId: randomUUID(), topicId: TOPIC }, ai: (req) => (req.label === "podcast outline" ? outline : chapterOut()) });
  const res = await handlePodcastRequest(h.env);
  assert.equal(res.status, 202);
  assert.equal(h.db.log.filter((l) => l === "reserve podcast").length, 1);
  await h.run();
  const m = h.db.finished[0]!.manifest as PodcastManifest;
  assert.equal(m.kind, "podcast");
  assert.equal(m.chapters.length, 6);
  assert.equal(h.tts.calls.length, 0, "no audio when the script is written");
});

/* ------------------------------------------------------------------------------------------------ chapter */

function podcastDb(status: "script" | "ready" | "synth" = "script") {
  const db = fakeDb();
  const id = randomUUID();
  const manifest: PodcastManifest = {
    v: 1,
    kind: "podcast",
    title: "P",
    topicId: TOPIC,
    estSec: 100,
    files: { script: "script.json" },
    chapters: [1, 2].map((n) => ({ n, title: `R${n}`, pointIds: ["p1"], levelIds: ["l1"], estSec: 50, durSec: null, status: n === 1 ? status : "script", pauses: [{ afterLine: 1, quizRef: { level: "l1", index: 0 }, pointId: "p1", lead: "x" }], files: null })),
  };
  db.rows.set(id, mediaRow({ id, kind: "podcast", status: "ready", manifest }));
  db.files.set(`${USER}/${id}/script.json`, JSON.stringify({ v: 1, title: "P", chapters: [1, 2].map((n) => ({ n, title: `R${n}`, lines: [{ s: "lis", t: "Cześć, tu **Lis**." }, { s: "szop", t: "A ja Szop!" }, { s: "lis", t: "Zaczynamy." }] })) }));
  return { db, id };
}

test("chapter: claimed → TTS per line (fox / szop voices, flash model), files cN.mp3 + cN.json, chapter ready; a ready chapter is served from cache without TTS", async () => {
  const { db, id } = podcastDb();
  const h = harness({ db, body: { mediaId: id, chapter: 1 } });
  const res = await handleChapterRequest(h.env);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const ch = res.body.chapter as { status: string; files: unknown; durSec: number };
  assert.equal(ch.status, "ready");
  assert.deepEqual(ch.files, { audio: "c1.mp3", timing: "c1.json" });
  assert.ok(ch.durSec > 0);
  assert.deepEqual(h.tts.calls.map((c) => [c.voiceId, c.modelId]), [["fox", "eleven_flash_v2_5"], ["szop", "eleven_flash_v2_5"], ["fox", "eleven_flash_v2_5"]]);
  assert.ok(db.files.has(`${USER}/${id}/c1.mp3`) && db.files.has(`${USER}/${id}/c1.json`));
  assert.ok(db.log.some((l) => /^budget \d+$/.test(l)), "TTS budget checked before synthesis");
  const again = harness({ db, body: { mediaId: id, chapter: 1 } });
  const cached = await handleChapterRequest(again.env);
  assert.equal(cached.status, 200);
  assert.equal(again.tts.calls.length, 0, "cached: no TTS");
});

test("chapter: busy → 409 chapter_busy; budget refused → 429 and the claim released; TTS failure → claim released + 503; not ready / not owner / out of range", async () => {
  {
    const { db, id } = podcastDb("synth");
    const res = await handleChapterRequest(harness({ db, body: { mediaId: id, chapter: 1 } }).env);
    assert.deepEqual([res.status, res.body.code], [409, "chapter_busy"]);
  }
  {
    const { db, id } = podcastDb();
    db.budget = false;
    const h = harness({ db, body: { mediaId: id, chapter: 1 } });
    const res = await handleChapterRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [429, "tts_budget"]);
    assert.ok(db.log.includes("releaseChapter 1"));
    assert.equal(h.tts.calls.length, 0);
    assert.equal((db.rows.get(id)!.manifest as PodcastManifest).chapters[0]!.status, "script");
  }
  {
    const { db, id } = podcastDb();
    const h = harness({ db, body: { mediaId: id, chapter: 1 }, tts: fakeTts(() => { throw new TtsError("tts_unavailable", "402 payment_required", 402); }) });
    const res = await handleChapterRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [503, "tts_unavailable"]);
    assert.ok(db.log.includes("releaseChapter 1"));
    assert.equal((db.rows.get(id)!.manifest as PodcastManifest).chapters[0]!.status, "script");
  }
  {
    const { db, id } = podcastDb();
    db.rows.get(id)!.status = "running";
    assert.equal((await handleChapterRequest(harness({ db, body: { mediaId: id, chapter: 1 } }).env)).body.code, "not_ready");
    db.rows.get(id)!.status = "ready";
    db.rows.get(id)!.owner_id = OTHER;
    assert.equal((await handleChapterRequest(harness({ db, body: { mediaId: id, chapter: 1 } }).env)).status, 404);
    db.rows.get(id)!.owner_id = USER;
    assert.equal((await handleChapterRequest(harness({ db, body: { mediaId: id, chapter: 7 } }).env)).status, 404);
  }
  const noVoices = harness({ env: { ELEVENLABS_API_KEY: "y" }, body: { mediaId: randomUUID(), chapter: 1 } });
  assert.equal((await handleChapterRequest(noVoices.env)).body.code, "voices_missing");
  assert.equal(noVoices.auth(), 0);
});

test("chapter (review F4): a line with nothing to say fails before any TTS or budget and counts as a failure; failing → 429 chapter_failing; a TTS failure mid-chapter gives the unspent characters back", async () => {
  {
    const { db, id } = podcastDb();
    db.files.set(`${USER}/${id}/script.json`, JSON.stringify({ v: 1, title: "P", chapters: [{ n: 1, title: "R1", lines: [{ s: "lis", t: "Cześć." }, { s: "szop", t: "** **" }, { s: "lis", t: "Zaczynamy." }] }] }));
    const h = harness({ db, body: { mediaId: id, chapter: 1 } });
    const res = await handleChapterRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [500, "synth_failed"]);
    assert.equal(h.tts.calls.length, 0, "no TTS");
    assert.ok(!db.log.some((l) => l.startsWith("budget")), "no budget spent");
    assert.equal(db.chapterFails, 1, "counted as a failure");
  }
  {
    const { db, id } = podcastDb();
    db.claimWith = "failing";
    const h = harness({ db, body: { mediaId: id, chapter: 1 } });
    const res = await handleChapterRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [429, "chapter_failing"]);
    assert.equal(h.tts.calls.length, 0);
  }
  {
    const { db, id } = podcastDb();
    // 6 lines, 4 at a time: the first fails, lines 5–6 are never sent
    const lines = ["Cześć, tu Lis.", "A ja Szop!", "Zaczynamy od podstaw.", "Dobrze, słucham.", "Pierwsza rzecz to definicja.", "Brzmi rozsądnie."].map((t, i) => ({ s: i % 2 ? "szop" : "lis", t }));
    db.files.set(`${USER}/${id}/script.json`, JSON.stringify({ v: 1, title: "P", chapters: [{ n: 1, title: "R1", lines }] }));
    const h = harness({ db, body: { mediaId: id, chapter: 1 }, tts: fakeTts((_r, call) => { if (call === 1) throw new TtsError("invalid_output", "422 bad text", 422); }) });
    const res = await handleChapterRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [500, "synth_failed"]);
    assert.equal(db.chapterFails, 1, "a paid failure counts");
    assert.equal(db.refunds.length, 1, "unspent characters given back");
    assert.ok(db.refunds[0]! > 0 && db.refunds[0]! < db.budgeted[0]!, `refund ${db.refunds[0]} of ${db.budgeted[0]}`);
  }
  {
    const { db, id } = podcastDb();
    db.budget = false;
    await handleChapterRequest(harness({ db, body: { mediaId: id, chapter: 1 } }).env);
    assert.equal(db.chapterFails, 0, "a budget refusal is not a failure");
    assert.equal(db.refunds.length, 0);
  }
});

/* ---------------------------------------------------------------------------------------------------- fox */

const foxBody = (over: Record<string, unknown> = {}) => ({ subjectId: SUBJECT, topicIds: [TOPIC], pointIds: [`${TOPIC}:p3`], mode: "explain", step: "start", messages: [], ...over });
const FOX_OUT = { reply: "Hej.", question: "Wytłumacz, czym zajmuje się MFW.", verdict: "none", point: "T1.p3", good: [], gap: [], wrong: [], source: "", scores: [], gaps: [] };

test("fox: 200 with reply, question, pointId and the day's quota; the message is counted before the AI call", async () => {
  const h = harness({ body: foxBody(), ai: () => FOX_OUT });
  const res = await handleFoxRequest(h.env);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.next, "question");
  assert.deepEqual(res.body.question, { n: 1, text: "Wytłumacz, czym zajmuje się MFW." });
  assert.equal(res.body.pointId, `${TOPIC}:p3`);
  assert.deepEqual(res.body.quota, { day: "2026-10-22", used: 1, limit: 30, remaining: 29 });
  assert.ok(h.db.log.indexOf("reserveChat") >= 0);
  assert.equal(h.ai.calls.length, 1);
});

test("fox: the daily limit → 402 without an AI call; an AI failure → the message given back + 503; bad output → 500 fox_failed", async () => {
  {
    const db = fakeDb();
    db.chat = { ok: false, reason: "chat_daily", used: 30, limit: 30 };
    const h = harness({ db, body: foxBody() });
    const res = await handleFoxRequest(h.env);
    assert.deepEqual([res.status, res.body.code, res.body.reason, res.body.used, res.body.limit, res.body.charged], [402, "limit_reached", "chat_daily", 30, 30, false]);
    assert.equal(h.ai.calls.length, 0);
  }
  {
    const h = harness({ body: foxBody(), ai: () => { throw new MediaError("ai_unavailable", "529 overloaded"); } });
    const res = await handleFoxRequest(h.env);
    assert.deepEqual([res.status, res.body.code, res.body.charged], [503, "ai_unavailable", false]);
    assert.ok(h.db.log.includes("releaseChat 2026-10-22"));
  }
  {
    const h = harness({ body: foxBody(), ai: () => ({ ...FOX_OUT, question: "", reply: "" }) });
    const res = await handleFoxRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [500, "fox_failed"]);
    assert.ok(h.db.log.includes("releaseChat 2026-10-22"));
  }
});

test("fox: turn limits and wrong points are refused BEFORE counting; finish without answers needs no AI and no counter", async () => {
  {
    const msgs = [{ role: "fox", text: "P" }, { role: "user", text: "a" }, { role: "fox", text: "D" }, { role: "user", text: "b" }, { role: "fox", text: "ok" }, { role: "user", text: "c" }];
    const h = harness({ body: foxBody({ step: "answer", messages: msgs }) });
    const res = await handleFoxRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [400, "too_many_turns"]);
    assert.ok(!h.db.log.includes("reserveChat"));
  }
  {
    const h = harness({ body: foxBody({ pointIds: [`${TOPIC}:p42`] }) });
    assert.equal((await handleFoxRequest(h.env)).body.code, "bad_point");
    assert.ok(!h.db.log.includes("reserveChat"));
  }
  {
    const h = harness({ body: foxBody({ mode: "quiz", pointIds: [], step: "finish", messages: [{ role: "fox", text: "P1?" }] }) });
    const res = await handleFoxRequest(h.env);
    assert.equal(res.status, 200);
    assert.equal(res.body.next, "end");
    assert.ok(!h.db.log.includes("reserveChat"));
    assert.equal(h.ai.calls.length, 0);
  }
  {
    const h = harness({ body: foxBody({ subjectId: "55555555-5555-4555-8555-555555555555" }) });
    assert.equal((await handleFoxRequest(h.env)).status, 404);
  }
  {
    const h = harness({ env: { ELEVENLABS_API_KEY: "x" }, body: foxBody() });
    const res = await handleFoxRequest(h.env);
    assert.deepEqual([res.status, res.body.code], [503, "ai_unavailable"]);
    assert.equal(h.auth(), 0);
  }
});

/* --------------------------------------------------------------------------------------------------- /api/me */

test("/api/me media fields: with the RPCs → media, chat and features; without 0010 → null and features off; podcast needs the voices", async () => {
  const quota = { plan: "free", scope: "lifetime", used: 1, limit: 3, remaining: 2, dailyLeft: 4, globalOpen: true, busy: null };
  const chat = { day: "2026-10-22", used: 12, limit: 30, remaining: 18, globalOpen: true };
  const full = await buildMeMedia({ config: mediaConfig(FULL_ENV), mediaQuota: async () => quota, chatQuota: async () => chat, log: quiet });
  assert.deepEqual(full, { media: quota, chat, features: { reels: true, podcast: true, fox: true } });
  const noVoices = await buildMeMedia({ config: mediaConfig({ ANTHROPIC_API_KEY: "x", ELEVENLABS_API_KEY: "y" }), mediaQuota: async () => quota, chatQuota: async () => chat, log: quiet });
  assert.deepEqual(noVoices.features, { reels: true, podcast: false, fox: true });
  const noTts = await buildMeMedia({ config: mediaConfig({ ANTHROPIC_API_KEY: "x" }), mediaQuota: async () => quota, chatQuota: async () => chat, log: quiet });
  assert.deepEqual(noTts.features, { reels: false, podcast: false, fox: true });
  const missing = await buildMeMedia({
    config: mediaConfig(FULL_ENV),
    mediaQuota: async () => {
      throw new RpcMissingError("media_quota: Could not find the function");
    },
    chatQuota: async () => {
      throw new RpcMissingError("chat_quota: Could not find the function");
    },
    log: quiet,
  });
  assert.deepEqual(missing, { media: null, chat: null, features: { reels: false, podcast: false, fox: false } });
  const noAdmin = await buildMeMedia({ config: mediaConfig(FULL_ENV), mediaQuota: null, chatQuota: null, log: quiet });
  assert.deepEqual(noAdmin.features, { reels: false, podcast: false, fox: false });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { generationScope, legacyQuotaFields, parseGenerationQuota, PLANS, type GenerationQuota } from "./plans.js";

/** Owner decision 2026-10-15 (AUDYT D3): free = 2 generations for life (no monthly reset), pro unchanged (monthly). */

test("plans: free is 2 for life (monthly value mirrors it for older clients); pro keeps its monthly limit", () => {
  assert.equal(PLANS.free.generationsLifetime, 2);
  assert.equal(PLANS.free.generationsPerMonth, PLANS.free.generationsLifetime);
  assert.equal(PLANS.free.filesPerGeneration, 5);
  assert.equal(PLANS.pro.generationsPerMonth, 150);
  assert.equal(PLANS.pro.generationsLifetime, undefined);
  assert.equal(generationScope("free"), "lifetime");
  assert.equal(generationScope("pro"), "month");
});

test("parseGenerationQuota: the RPC's answer (snake_case) → GenerationQuota; junk → null", () => {
  assert.deepEqual(parseGenerationQuota({ plan: "free", scope: "lifetime", used: 1, limit: 2, remaining: 1, trial_until: null }), {
    plan: "free",
    scope: "lifetime",
    used: 1,
    limit: 2,
    remaining: 1,
    trialUntil: null,
  });
  const pro = parseGenerationQuota({ plan: "pro", scope: "month", used: 3, limit: 150, remaining: 147, month: "2026-10", trial_until: "2026-11-02T10:00:00+00:00" });
  assert.deepEqual(pro, { plan: "pro", scope: "month", used: 3, limit: 150, remaining: 147, trialUntil: "2026-11-02T10:00:00+00:00" });
  // remaining is recomputed (never negative, also after the limit was lowered in app_config)
  assert.equal(parseGenerationQuota({ plan: "free", scope: "lifetime", used: 3, limit: 1, remaining: 0 })!.remaining, 0);
  assert.equal(parseGenerationQuota({ plan: "free", scope: "lifetime", used: "2", limit: "2" })!.used, 2);
  for (const bad of [null, undefined, "x", 3, {}, { scope: "week", used: 1, limit: 2 }, { scope: "lifetime", used: -1, limit: 2 }, { scope: "month", used: 1 }, { scope: "lifetime", used: 1, limit: "dwa" }])
    assert.equal(parseGenerationQuota(bad), null, JSON.stringify(bad));
});

test("parseGenerationQuota: free_limit and global_open (additive) are passed through when valid, left out otherwise", () => {
  const q = parseGenerationQuota({ plan: "pro", scope: "month", used: 1, limit: 150, trial_until: null, free_limit: 2, global_open: false })!;
  assert.equal(q.freeLimit, 2);
  assert.equal(q.globalOpen, false);
  const old = parseGenerationQuota({ plan: "free", scope: "lifetime", used: 0, limit: 2 })!;
  assert.equal("freeLimit" in old, false);
  assert.equal("globalOpen" in old, false);
  const junk = parseGenerationQuota({ plan: "free", scope: "lifetime", used: 0, limit: 2, free_limit: -1, global_open: "no" })!;
  assert.equal("freeLimit" in junk, false);
  assert.equal("globalOpen" in junk, false);
});

test("legacyQuotaFields: older clients see the lifetime counter as 'X of Y' (build 6 blocks at 2 of 2); month quotas unchanged", () => {
  const life: GenerationQuota = { plan: "free", scope: "lifetime", used: 2, limit: 2, remaining: 0, trialUntil: null };
  const v = legacyQuotaFields("free", 0, life);
  assert.equal(v.generations, 2);
  assert.equal(v.limits.generationsPerMonth, 2);
  assert.equal(v.limits.generationsLifetime, 2);
  assert.equal(v.limits.filesPerGeneration, PLANS.free.filesPerGeneration);
  // limit raised in app_config: the legacy fields follow the database, not the constant
  assert.equal(legacyQuotaFields("free", 0, { ...life, used: 1, limit: 5, remaining: 4 }).limits.generationsPerMonth, 5);
  const month: GenerationQuota = { plan: "pro", scope: "month", used: 3, limit: 150, remaining: 147, trialUntil: null };
  assert.deepEqual(legacyQuotaFields("pro", 3, month), { generations: 3, limits: PLANS.pro });
  // no quota (database without backend/0007): exactly the old answer
  assert.deepEqual(legacyQuotaFields("free", 1, null), { generations: 1, limits: PLANS.free });
});

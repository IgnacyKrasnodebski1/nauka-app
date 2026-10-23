#!/usr/bin/env node
/**
 * Migration tests on a THROWAWAY local Postgres (never a real project): starts a temporary cluster, stubs the parts of
 * Supabase the migrations use (auth.users / auth.uid(), storage.objects with RLS, pg_cron's API, the API roles), applies
 * 0001 + Cramfox 0004–0009 (0007, 0008 and 0009 twice: idempotence; 0009 both before and after 0008) and checks the
 * generation guards (AUDYT P0-1, P1-3, P1-4), the refund of a generation the AI failed on our side (0009,
 * release_generation — incident 2026-10-16),
 * the free plan's lifetime generations keyed by the e-mail hash (and their reset), no trial for new accounts, the
 * configurable global cap with its free pool (D3 / P0-2, owner decision 2026-10-15) and the account limits (P1-5),
 * including real parallel sessions racing for a reservation. When nauka-app/backend/0010_media.sql is present: the media
 * creation pool, release / sweep, podcast chapter claims, the fox chat counter, the TTS budget, RLS and the media bucket.
 *
 *   npm run test:db                       # needs initdb / pg_ctl / psql (e.g. brew install postgresql@16)
 *   CRAMFOX_MIGRATIONS=../nauka-app/backend PG_BIN=/opt/homebrew/opt/postgresql@16/bin DB_TEST_DIR=/tmp/x node supabase/tests/db-test.mjs [--keep]
 *
 * Without Postgres binaries it prints "skip" and exits 0 (CI has none).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, appendFileSync, mkdirSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "../..");
const migrationsDir = path.resolve(process.env.CRAMFOX_MIGRATIONS || path.join(backendRoot, "../nauka-app/backend"));
const keep = process.argv.includes("--keep");

function findBin() {
  const candidates = [process.env.PG_BIN, "/opt/homebrew/opt/postgresql@16/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/lib/postgresql/16/bin", "/usr/bin"].filter(Boolean);
  const which = spawnSync("sh", ["-c", "command -v initdb"], { encoding: "utf8" }).stdout.trim();
  if (which) candidates.unshift(path.dirname(which));
  return candidates.find((d) => ["initdb", "pg_ctl", "psql"].every((b) => existsSync(path.join(d, b))));
}

const bin = findBin();
if (!bin) {
  console.log("skip: no local Postgres binaries (initdb, pg_ctl, psql) — set PG_BIN to run the migration tests");
  process.exit(0);
}
for (const f of ["0004_cramfox.sql", "0005_materials_50mb.sql", "0006_pptx.sql", "0007_generation_guards.sql", "0008_account_limits.sql", "0009_release_generation.sql"])
  if (!existsSync(path.join(migrationsDir, f))) {
    console.error(`missing ${f} in ${migrationsDir} (set CRAMFOX_MIGRATIONS)`);
    process.exit(1);
  }

const port = await new Promise((res) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});
const base = process.env.DB_TEST_DIR ? (mkdirSync(process.env.DB_TEST_DIR, { recursive: true }), mkdtempSync(path.join(process.env.DB_TEST_DIR, "pg-"))) : mkdtempSync(path.join(os.tmpdir(), "nauka-dbtest-"));
const data = path.join(base, "data");
// macOS: the postmaster refuses to start ("became multithreaded during startup") without a valid LC_ALL
const env = { ...process.env, LC_ALL: "C", LANG: "C", PGTZ: "UTC" };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(path.join(bin, cmd), args, { encoding: "utf8", env, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
const psqlArgs = ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "cramfox_test", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t"];
const psql = (sql) => run("psql", [...psqlArgs, "-c", sql]).trim();
const psqlFile = (sql) => {
  const r = spawnSync(path.join(bin, "psql"), psqlArgs, { input: sql, encoding: "utf8", env });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim());
  return r.stdout.trim();
};
/** async psql (parallel sessions) */
const psqlAsync = (sql) =>
  new Promise((resolve) => {
    const c = spawn(path.join(bin, "psql"), [...psqlArgs, "-c", sql], { stdio: ["ignore", "pipe", "pipe"], env });
    let out = "";
    let err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** pg_cron is stubbed: the CREATE EXTENSION line is dropped, the rest of the migration runs unchanged */
const migration = (file) => readFileSync(file, "utf8").replace(/^\s*create extension if not exists pg_cron;\s*$/gim, "-- (db-test: pg_cron stubbed)");

let failed = 0;
const results = [];
async function check(name, f) {
  try {
    psql("select t.reset()");
    await f();
    results.push(`ok - ${name}`);
  } catch (e) {
    failed++;
    results.push(`not ok - ${name}\n    ${String(e.message || e).split("\n").join("\n    ")}`);
  }
}
const eq = (a, b, msg) => {
  if (String(a) !== String(b)) throw new Error(`${msg}: expected ${b}, got ${a}`);
};

try {
  run("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C", "--no-instructions"]);
  appendFileSync(path.join(data, "postgresql.conf"), `\nport = ${port}\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = ''\nfsync = off\nsynchronous_commit = off\n`);
  run("pg_ctl", ["-D", data, "-l", path.join(base, "pg.log"), "-w", "start"]);
  run("psql", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-X", "-q", "-c", "create database cramfox_test"]);

  psqlFile(readFileSync(path.join(here, "stubs.sql"), "utf8"));
  psqlFile(readFileSync(path.join(backendRoot, "supabase/migrations/0001_init.sql"), "utf8"));
  for (const f of ["0004_cramfox.sql", "0005_materials_50mb.sql", "0006_pptx.sql"]) psqlFile(migration(path.join(migrationsDir, f)));
  // production before 0007: an account still on its trial and a free account with history, so 0007's backfill has work
  psqlFile(`do $$ declare tr uuid; fr uuid; begin
    insert into auth.users (email, raw_user_meta_data) values ('stary.trial@test.local', '{"client":"cramfox"}') returning id into tr;
    insert into auth.users (email, raw_user_meta_data) values ('Stary.Free@Test.local', '{}') returning id into fr;
    assert (select plan = 'pro' and trial_until > now() + interval '29 days' from public.profiles where id = tr), '0004: trial for Cramfox sign-ups';
    update public.profiles set trial_until = now() - interval '5 days', plan = 'free' where id = fr;
    insert into public.generations (owner_id, status, stage, created_at) values
      (tr, 'done', 'liceum', now() - interval '3 days'),   -- trial: never counts
      (fr, 'done', 'liceum', now() - interval '10 days'),  -- during its trial: does not count
      (fr, 'done', 'liceum', now() - interval '2 days'),   -- on the free plan: counts
      (fr, 'failed', 'liceum', now() - interval '1 day');  -- charged, failed: counts
  end $$;`);
  // 0009 before 0008 on the first pass, after it on the second (the documented order allows both); 0009 twice in a row.
  // Re-running 0007 reverts 0009's versions of the day counters and the backfill — so 0009 always follows a re-run of 0007.
  for (const f of ["0007_generation_guards.sql", "0009_release_generation.sql", "0008_account_limits.sql", "0007_generation_guards.sql", "0008_account_limits.sql", "0009_release_generation.sql", "0009_release_generation.sql"])
    psqlFile(migration(path.join(migrationsDir, f)));
  results.push("ok - migrations 0001, 0004–0009 apply; 0007, 0008 and 0009 apply a second time (idempotent), 0009 before and after 0008");
  {
    const pre = psql(`select (select string_agg(key || '=' || value::text, ',' order by key) from public.app_config) || '|' ||
      (select count(*) from public.free_generation_ledger) || '|' ||
      (select count(*) from public.free_generation_ledger where email_hash = public.email_hash('stary.free@test.local')) || '|' ||
      (select p.plan::text || (p.trial_until > now()) from public.profiles p join auth.users u on u.id = p.id where u.email = 'stary.trial@test.local')`);
    eq(pre, "free_global_daily_cap=20,free_lifetime_generations=2,generation_global_daily_cap=30|2|2|protrue", "defaults / backfill after 0007 + 0008 (twice)");
    results.push("ok - 0007 defaults: global cap 30 (free pool 20 of it), free lifetime 2; backfill counts only free-plan history (not trial-era rows), once despite re-runs; a running trial is kept");
  }

  psqlFile(`
    create schema t;
    create function t.reset() returns void language sql as $$
      truncate public.generations, public.generation_ledger, public.free_generation_ledger, public.usage, public.topics, public.materials, public.subjects, storage.objects cascade;
      insert into public.app_config (key, value) values ('generation_global_daily_cap', '30'), ('free_lifetime_generations', '2'), ('free_global_daily_cap', '20')
        on conflict (key) do update set value = excluded.value;
    $$;
    -- an account created before 0007 that is still on its 30-day trial (plan pro): most guard tests exercise the monthly logic
    create function t.new_user() returns uuid language plpgsql as $$
    declare u uuid;
    begin
      insert into auth.users (email, raw_user_meta_data) values (gen_random_uuid() || '@test.local', '{"client":"cramfox"}') returning id into u;
      update public.profiles set plan = 'pro', trial_until = now() + interval '30 days' where id = u;
      return u;
    end $$;
    -- a sign-up after 0007: free, no trial
    create function t.new_free_user(p_email text default null) returns uuid language sql as $$
      insert into auth.users (email, raw_user_meta_data) values (coalesce(p_email, gen_random_uuid() || '@test.local'), '{"client":"cramfox"}') returning id
    $$;
    create function t.new_subject(u uuid) returns uuid language sql as $$
      insert into public.subjects (owner_id, name) values (u, 'Biologia') returning id
    $$;
    -- a reservation that does not leave the account busy: reserve, then close the row as done
    create function t.reserve_done(u uuid, s uuid, p_month text default '2026-10', p_limit int default 150) returns jsonb language plpgsql as $$
    declare r jsonb;
    begin
      r := public.reserve_generation(u, p_month, p_limit, s, 'liceum', null, '{}', '{}');
      if (r->>'ok')::boolean then update public.generations set status = 'done' where id = (r->>'generation_id')::uuid; end if;
      return r;
    end $$;
  `);

  await check("privileges: reserve/finish/sweep/stats only for service_role; cost view hidden from API roles", async () => {
    psqlFile(`do $$ begin
      assert not has_function_privilege('authenticated', 'public.reserve_generation(uuid,text,int,uuid,text,text,jsonb,uuid[])', 'execute'), 'authenticated reserve';
      assert not has_function_privilege('anon', 'public.reserve_generation(uuid,text,int,uuid,text,text,jsonb,uuid[])', 'execute'), 'anon reserve';
      assert has_function_privilege('service_role', 'public.reserve_generation(uuid,text,int,uuid,text,text,jsonb,uuid[])', 'execute'), 'service reserve';
      assert not has_function_privilege('authenticated', 'public.finish_generation(uuid,jsonb,jsonb)', 'execute'), 'authenticated finish';
      assert has_function_privilege('service_role', 'public.finish_generation(uuid,jsonb,jsonb)', 'execute'), 'service finish';
      assert not has_function_privilege('authenticated', 'public.sweep_stale_generations()', 'execute'), 'authenticated sweep';
      assert not has_function_privilege('authenticated', 'public.materials_bucket_stats()', 'execute'), 'authenticated stats';
      assert not has_function_privilege('authenticated', 'public.enforce_owner_caps()', 'execute'), 'authenticated caps fn';
      assert not has_table_privilege('authenticated', 'public.generation_cost_daily', 'select'), 'authenticated view';
      assert not has_table_privilege('anon', 'public.generation_cost_daily', 'select'), 'anon view';
      assert has_table_privilege('service_role', 'public.generation_cost_daily', 'select'), 'service view';
      -- D3: the quota read, the config and the e-mail ledger are server-only
      assert not has_function_privilege('authenticated', 'public.generation_quota(uuid,text,int)', 'execute'), 'authenticated quota';
      assert not has_function_privilege('anon', 'public.generation_quota(uuid,text,int)', 'execute'), 'anon quota';
      assert has_function_privilege('service_role', 'public.generation_quota(uuid,text,int)', 'execute'), 'service quota';
      assert not has_function_privilege('authenticated', 'public.app_config_int(text,int)', 'execute'), 'authenticated config fn';
      assert not has_function_privilege('authenticated', 'public.email_hash(text)', 'execute'), 'authenticated email_hash';
      assert not has_function_privilege('authenticated', 'public.account_email_hash(uuid)', 'execute'), 'authenticated account hash';
      assert not has_function_privilege('anon', 'public.free_generations_used(uuid,text)', 'execute'), 'anon free used';
      assert not has_function_privilege('authenticated', 'public.backfill_free_generation_ledger()', 'execute'), 'authenticated backfill';
      assert not has_function_privilege('authenticated', 'public.increment_usage(uuid,text,text)', 'execute'), 'authenticated increment_usage';
      assert not has_function_privilege('authenticated', 'public.generations_last_day()', 'execute'), 'authenticated day count';
      assert not has_function_privilege('anon', 'public.free_generations_last_day()', 'execute'), 'anon free day count';
      assert not has_function_privilege('authenticated', 'public.reset_free_generations(text)', 'execute'), 'authenticated reset';
      assert not has_function_privilege('anon', 'public.reset_free_generations(text)', 'execute'), 'anon reset';
      -- 0009: the refund is server-only (a signed-in user must not give themselves generations back)
      assert not has_function_privilege('authenticated', 'public.release_generation(uuid,text)', 'execute'), 'authenticated release';
      assert not has_function_privilege('anon', 'public.release_generation(uuid,text)', 'execute'), 'anon release';
      assert has_function_privilege('service_role', 'public.release_generation(uuid,text)', 'execute'), 'service release';
      assert not has_column_privilege('authenticated', 'public.generations', 'refunded_at', 'select'), 'refunded_at hidden from clients (0008 column grants)';
      assert has_column_privilege('authenticated', 'public.generations', 'error', 'select'), 'error readable (the client sees the released: prefix)';
      assert not has_table_privilege('authenticated', 'public.app_config', 'select'), 'authenticated config';
      assert not has_table_privilege('anon', 'public.app_config', 'select'), 'anon config';
      assert not has_table_privilege('authenticated', 'public.app_config', 'update'), 'authenticated config update';
      assert not has_table_privilege('authenticated', 'public.free_generation_ledger', 'select'), 'authenticated free ledger';
      assert not has_table_privilege('authenticated', 'public.free_generation_ledger', 'delete'), 'authenticated free ledger delete';
      assert not has_table_privilege('anon', 'public.free_generation_ledger', 'insert'), 'anon free ledger';
      assert (select relrowsecurity from pg_class where oid = 'public.app_config'::regclass), 'RLS on app_config';
      assert (select relrowsecurity from pg_class where oid = 'public.free_generation_ledger'::regclass), 'RLS on free ledger';
    end $$;`);
    const u = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    let denied = false;
    try {
      psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false);
        select public.reserve_generation('${u}', '2026-10', 999, '${s}', 'liceum', null, '{}', '{}');`);
    } catch (e) {
      denied = /permission denied/.test(e.message);
    }
    if (!denied) throw new Error("a signed-in user could call reserve_generation (charge or bypass)");
    let releaseDenied = false;
    try {
      psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false);
        select public.release_generation(gen_random_uuid(), 'ai_unavailable');`);
    } catch (e) {
      releaseDenied = /permission denied/.test(e.message);
    }
    if (!releaseDenied) throw new Error("a signed-in user could call release_generation (refund themselves)");
  });

  await check("reserve_generation: inserts the running row with the client's fields, counts usage; a second one is busy and changes nothing", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); m uuid := gen_random_uuid(); r jsonb; g public.generations%rowtype; begin
      r := public.reserve_generation(u, '2026-10', 3, s, 'liceum', 'rozdział 2', '{"mode":"materials","levels":4,"viz":true}', array[m]);
      assert (r->>'ok')::boolean and (r->>'used')::int = 1 and (r->>'limit')::int = 3, r::text;
      select * into g from public.generations where id = (r->>'generation_id')::uuid;
      assert g.status = 'running' and g.owner_id = u and g.subject_id = s and g.stage = 'liceum' and g.hint = 'rozdział 2', 'row fields';
      assert g.options->>'levels' = '4' and g.material_ids = array[m], 'options / material_ids (client recovery matches on them)';
      r := public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "busy"}'::jsonb, r::text;
      assert (select count(*) from public.generations where owner_id = u) = 1, 'no second row';
      assert (select generations from public.usage where user_id = u and month = '2026-10') = 1, 'usage unchanged';
    end $$;`);
  });

  await check("monthly limit is checked BEFORE counting: at 3/3 → monthly, counter stays 3 (was 4/3)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; begin
      insert into public.usage (user_id, month, generations) values (u, '2026-10', 3);
      r := public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "monthly", "used": 3, "limit": 3}'::jsonb, r::text;
      assert (select generations from public.usage where user_id = u and month = '2026-10') = 3;
      assert not exists (select 1 from public.generations where owner_id = u);
      r := public.reserve_generation(u, '2026-11', 3, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'a new month starts from 0';
    end $$;`);
  });

  await check("daily cap 20 per account in a rolling 24 h (failed ones count, older ones do not)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) select u, 'failed', 'liceum', now() - interval '25 hours' from generate_series(1, 30);
      insert into public.generations (owner_id, status, stage, created_at) select u, 'done', 'liceum', now() - interval '1 hour' from generate_series(1, 19);
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, '19 in 24 h → the 20th is allowed: ' || r::text;
      update public.generations set status = 'failed' where id = (r->>'generation_id')::uuid;
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "daily", "limit": 20}'::jsonb, r::text;
      assert (select generations from public.usage where user_id = u) = 1;
    end $$;`);
  });

  await check("global cap (app_config, default 30) in 24 h for the whole server", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); s uuid := t.new_subject(u); f uuid := t.new_free_user(); sf uuid := t.new_subject(f); r jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '25 hours' from generate_series(1, 100);
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '2 hours' from generate_series(1, 29);
      r := t.reserve_done(u, s);
      assert (r->>'ok')::boolean, '29 in 24 h → the 30th is allowed: ' || r::text;
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 30}'::jsonb, r::text;
      assert (select generations from public.usage where user_id = u) = 1;
      r := public.reserve_generation(f, '2026-10', 2, sf, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 30}'::jsonb, 'free account: ' || r::text;
      assert not exists (select 1 from public.free_generation_ledger), 'a refused free reservation is not counted';
    end $$;`);
  });

  await check("race (P0-1): 12 parallel sessions for one account → exactly one reservation, usage 1", async () => {
    const u = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    // hold the account's lock so all 12 queue on it, then let them through together
    const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:generation:user'), hashtext('${u}')); select pg_sleep(0.8); commit;`);
    await sleep(200);
    const racers = Array.from({ length: 12 }, () => psqlAsync(`select public.reserve_generation('${u}', '2026-10', 150, '${s}', 'liceum', null, '{}', '{}')->>'reason'`));
    const out = await Promise.all(racers);
    await holder;
    const errs = out.filter((o) => o.code !== 0);
    if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
    const reasons = out.map((o) => o.out || "ok").sort();
    eq(reasons.filter((r) => r === "ok").length, 1, `one success (${reasons.join(",")})`);
    eq(reasons.filter((r) => r === "busy").length, 11, "the rest busy");
    eq(psql(`select count(*) from public.generations where owner_id = '${u}'`), 1, "rows");
    eq(psql(`select generations from public.usage where user_id = '${u}'`), 1, "usage");
  });

  await check("race (P0-1): 10 accounts in parallel at 29/30 globally → exactly one gets through", async () => {
    const filler = psql("select t.new_user()");
    psql(`insert into public.generations (owner_id, status, stage) select '${filler}', 'done', 'liceum' from generate_series(1, 29)`);
    const users = Array.from({ length: 10 }, () => {
      const u = psql("select t.new_user()");
      return { u, s: psql(`select t.new_subject('${u}')`) };
    });
    const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:generation:global'), 0); select pg_sleep(0.8); commit;`);
    await sleep(200);
    const out = await Promise.all(users.map(({ u, s }) => psqlAsync(`select public.reserve_generation('${u}', '2026-10', 150, '${s}', 'liceum', null, '{}', '{}')->>'reason'`)));
    await holder;
    const errs = out.filter((o) => o.code !== 0);
    if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
    const reasons = out.map((o) => o.out || "ok");
    eq(reasons.filter((r) => r === "ok").length, 1, `one success (${reasons.join(",")})`);
    eq(reasons.filter((r) => r === "global").length, 9, "the rest hit the global cap");
    eq(psql("select count(*) from public.generations"), 30, "never over 30");
  });

  await check("global cap survives account deletion: generation_ledger has no link to auth.users (deleting accounts does not reset the 24 h cap)", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); s uuid := t.new_subject(u); v uuid := t.new_user(); sv uuid := t.new_subject(v); r jsonb; begin
      -- 29 earlier reservations of an account that is then deleted (as by delete_my_account)
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '3 hours' from generate_series(1, 29);
      insert into public.generation_ledger (created_at) select now() - interval '3 hours' from generate_series(1, 29);
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'the 30th is allowed: ' || r::text;
      assert (select count(*) from public.generation_ledger) = 30, 'every reservation is in the ledger';
      delete from auth.users where id in (a, u);
      assert (select count(*) from public.generations) = 0, 'rows gone with the accounts (cascade)';
      r := public.reserve_generation(v, '2026-10', 150, sv, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 30}'::jsonb, 'cap still reached after deleting the accounts: ' || r::text;
      assert not exists (select 1 from public.usage where user_id = v);
    end $$;`);
    psql("select t.reset()");
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; begin
      insert into public.generation_ledger (created_at) select now() - interval '25 hours' from generate_series(1, 400);
      insert into public.generation_ledger (created_at) select now() - interval '3 days' from generate_series(1, 10);
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'entries older than 24 h do not count: ' || r::text;
      assert (select count(*) from public.generation_ledger where created_at < now() - interval '2 days') = 0, 'entries older than 2 days are deleted';
    end $$;`);
    psqlFile(`do $$ begin
      assert not has_table_privilege('authenticated', 'public.generation_ledger', 'select'), 'authenticated ledger';
      assert not has_table_privilege('anon', 'public.generation_ledger', 'insert'), 'anon ledger';
      assert not has_table_privilege('authenticated', 'public.generation_ledger', 'delete'), 'authenticated ledger delete';
    end $$;`);
  });

  await check("busy window 5.5 min: a running row younger than 330 s blocks the account, an older one does not (Cramfox shows `lost` at 330 s)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; g uuid; begin
      insert into public.generations (owner_id, status, stage, created_at) values (u, 'running', 'liceum', now() - interval '320 seconds') returning id into g;
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "busy"}'::jsonb, '320 s old → busy: ' || r::text;
      update public.generations set created_at = now() - interval '340 seconds' where id = g;
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, '340 s old → not busy: ' || r::text;
    end $$;`);
  });

  await check("reserve_generation takes the account lock, the e-mail lock (free) and the global lock (a held lock makes it wait)", async () => {
    const u = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    const f = psql("select t.new_free_user('Lock.Test@test.local')");
    const sf = psql(`select t.new_subject('${f}')`);
    for (const [label, key, who, subj] of [
      ["account", `hashtext('cramfox:generation:user'), hashtext('${u}')`, u, s],
      ["global", `hashtext('cramfox:generation:global'), 0`, u, s],
      // a free account waits for its normalized address (two live accounts with one address share the free 2)
      ["e-mail", `hashtext('cramfox:generation:email'), hashtext(public.email_hash('lock.test@test.local'))`, f, sf],
    ]) {
      const holder = psqlAsync(`begin; select pg_advisory_xact_lock(${key}); select pg_sleep(0.6); commit;`);
      await sleep(200);
      const r = await psqlAsync(`set lock_timeout = '150ms'; select public.reserve_generation('${who}', '2026-10', 150, '${subj}', 'liceum', null, '{}', '{}')`);
      await holder;
      if (r.code === 0 || !/lock timeout/i.test(r.err)) throw new Error(`${label} lock not taken: ${r.code} ${r.out} ${r.err}`);
    }
    eq(psql(`select count(*) from public.generations where owner_id in ('${u}', '${f}')`), 0, "nothing reserved while waiting");
    eq(psql(`select count(*) from public.free_generation_ledger`), 0, "nothing counted while waiting");
  });

  await check("finish_generation: topic + done + cost columns in one transaction; positions max+1; not twice; deleted subject → error", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; tp jsonb; g public.generations%rowtype; ok boolean; begin
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      tp := public.finish_generation((r->>'generation_id')::uuid,
        '{"name":"Fotosynteza","emoji":"🌿","source":"materials","content":{"name":"Fotosynteza","levels":[]}}',
        '{"model":"claude-opus-5","input_tokens":1500,"output_tokens":300,"opus_input":100,"opus_cache_write":1000,"opus_cache_read":200,"opus_output":250,"review_input":200,"review_output":50,"cost_usd":0.1234,"quality":{"levelsFailed":0}}');
      assert tp->>'name' = 'Fotosynteza' and (tp->>'position')::int = 0 and tp->>'subject_id' = s::text and tp->>'owner_id' = u::text and tp->>'generation_id' = r->>'generation_id', tp::text;
      select * into g from public.generations where id = (r->>'generation_id')::uuid;
      assert g.status = 'done' and g.topic_id = (tp->>'id')::uuid and g.finished_at is not null and g.model = 'claude-opus-5', 'done';
      assert g.opus_cache_write = 1000 and g.opus_cache_read = 200 and g.review_output = 50 and g.cost_usd = 0.1234 and g.quality->>'levelsFailed' = '0' and g.input_tokens = 1500, 'cost columns';
      begin
        perform public.finish_generation((r->>'generation_id')::uuid, '{"name":"x","content":{}}', '{}');
        ok := false;
      exception when others then ok := sqlerrm like 'generation_not_running%';
      end;
      assert ok, 'a done generation cannot be finished again';
      assert (select count(*) from public.topics where subject_id = s) = 1;
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      tp := public.finish_generation((r->>'generation_id')::uuid, '{"name":"Drugi","source":"materials","content":{"name":"Drugi"}}', '{"model":"demo"}');
      assert (tp->>'position')::int = 1 and tp->>'emoji' = '📘', tp::text;
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      delete from public.subjects where id = s;
      begin
        perform public.finish_generation((r->>'generation_id')::uuid, '{"name":"x","content":{}}', '{}');
        ok := false;
      exception when others then ok := sqlerrm = 'subject_missing';
      end;
      assert ok, 'subject deleted meanwhile → subject_missing, no orphan topic';
    end $$;`);
  });

  await check("sweeper: running/queued rows older than 8 min → failed (no refund, TODO D4); fresh ones untouched; cron every 5 min", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); old uuid; fresh uuid; q uuid; n int; r jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) values (u, 'running', 'liceum', now() - interval '9 minutes') returning id into old;
      insert into public.generations (owner_id, status, stage, created_at) values (u, 'queued', 'liceum', now() - interval '20 minutes') returning id into q;
      -- a 9-minute-old running row no longer blocks the account, even before the sweep
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      fresh := (r->>'generation_id')::uuid;
      n := public.sweep_stale_generations();
      assert n = 2, 'swept ' || n;
      assert (select status from public.generations where id = old) = 'failed';
      assert (select error from public.generations where id = old) like 'stale:%';
      assert (select finished_at from public.generations where id = q) is not null;
      assert (select status from public.generations where id = fresh) = 'running';
      assert (select generations from public.usage where user_id = u) = 1, 'no refund (decision D4)';
      assert (select schedule from cron.job where jobname = 'cramfox-sweep-generations') = '*/5 * * * *';
      assert (select command from cron.job where jobname = 'cramfox-sweep-generations') = 'select public.sweep_stale_generations()';
      assert (select count(*) from cron.job where jobname = 'cramfox-end-trials') = 1, '0004 job still there';
    end $$;`);
  });

  // ---- 0009: release_generation (incident 2026-10-16: the AI failed on our side — invalid API key — and the user was charged)
  await check("release_generation (0009): pro/trial account — usage −1, generation_ledger entry voided, global count back, row failed + refunded_at + released: prefix; a second call is a no-op", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; x jsonb; g uuid; gr public.generations%rowtype; begin
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      g := (r->>'generation_id')::uuid;
      assert (select generations from public.usage where user_id = u and month = mk) = 1, 'charged';
      assert public.generations_last_day() = 1 and (select count(*) from public.generation_ledger where voided_at is null) = 1, 'counted globally';
      -- a row already failed (a manual refund in the SQL Editor, or a refund that landed after the route's fallback fail)
      update public.generations set status = 'failed', error = 'ai_unavailable: 401 authentication_error [req_1]', finished_at = now() where id = g;
      x := public.release_generation(g, 'ai_unavailable');
      assert x = jsonb_build_object('ok', true, 'generation_id', g, 'usage', 1, 'free_ledger', 0, 'ledger', 1), x::text;
      select * into gr from public.generations where id = g;
      assert gr.status = 'failed' and gr.refunded_at is not null and gr.finished_at is not null, 'row';
      assert gr.error = 'released:ai_unavailable | ai_unavailable: 401 authentication_error [req_1]', gr.error;
      assert (select generations from public.usage where user_id = u and month = mk) = 0, 'usage restored';
      assert (select count(*) from public.generation_ledger) = 1 and (select count(*) from public.generation_ledger where voided_at is null) = 0, 'ledger entry voided, not deleted';
      assert public.generations_last_day() = 0, 'the global 24 h count no longer includes it';
      assert (public.generation_quota(u, mk, 150)->>'used')::int = 0, 'quota for /api/me';
      x := public.release_generation(g, 'ai_unavailable');
      assert x = jsonb_build_object('ok', true, 'already', true, 'generation_id', g), 'idempotent: ' || x::text;
      assert (select generations from public.usage where user_id = u and month = mk) = 0, 'a second call changes nothing';
      assert (select error from public.generations where id = g) = gr.error, 'error not prefixed twice';
      assert (select count(*) from public.generation_ledger where voided_at is null) = 0;
      -- not busy any more; the next reservation counts from 0 again
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean and (r->>'used')::int = 1, r::text;
    end $$;`);
  });

  await check("release_generation (0009): free plan — the lifetime lesson comes back (e-mail ledger voided + refunded), free pool not counted; a still-running row is closed; survives re-running 0007/0008/0009 and the backfill", async () => {
    const u = psql("select t.new_free_user('Zwrot.Limitu@test.local')");
    const s = psql(`select t.new_subject('${u}')`);
    psqlFile(`do $$ declare u uuid := '${u}'; s uuid := '${s}'; mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; x jsonb; g uuid; begin
      r := t.reserve_done(u, s, mk, 2);
      assert (r->>'used')::int = 1, r::text;
      r := public.reserve_generation(u, mk, 2, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean and (r->>'used')::int = 2, r::text;
      g := (r->>'generation_id')::uuid;
      assert public.reserve_generation(u, mk, 2, s, 'liceum', null, '{}', '{}')->>'reason' = 'busy', 'running';
      -- what the route does: release a still-running row (release INSTEAD of fail, so a polling client never sees a failed,
      -- not yet refunded row); the reason carries the original error
      x := public.release_generation(g, 'ai_unavailable: 401 authentication_error [req_1]: invalid x-api-key');
      assert (x->>'ok')::boolean and (x->>'usage')::int = 1 and (x->>'free_ledger')::int = 1 and (x->>'ledger')::int = 1, x::text;
      assert (select status = 'failed' and refunded_at is not null and finished_at is not null and error = 'released:ai_unavailable: 401 authentication_error [req_1]: invalid x-api-key' from public.generations where id = g), 'closed';
      assert (select voided_at is not null and refunded_at is not null from public.free_generation_ledger where generation_id = g), 'e-mail ledger row voided and refunded';
      assert public.free_generations_used(u, public.account_email_hash(u)) = 1, 'the free lesson came back';
      assert (public.generation_quota(u, mk, 2)->>'remaining')::int = 1, 'quota: 1 left';
      assert public.free_generations_last_day() = 1, 'the free pool counts only the done one';
      assert (select sum(generations) from public.usage where user_id = u) = 1, 'monthly statistics';
      assert public.backfill_free_generation_ledger() = 0, 'the backfill does not re-add it';
      assert (public.release_generation(g, 'ai_unavailable')->>'already')::boolean, 'idempotent';
      assert public.free_generations_used(u, public.account_email_hash(u)) = 1;
    end $$;`);
    for (const f of ["0007_generation_guards.sql", "0008_account_limits.sql", "0009_release_generation.sql"]) psqlFile(migration(path.join(migrationsDir, f)));
    psqlFile(`do $$ declare u uuid := '${u}'; s uuid := '${s}'; mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; begin
      assert public.free_generations_used(u, public.account_email_hash(u)) = 1, 'still refunded after re-running 0007, 0008, 0009';
      assert public.free_generations_last_day() = 1 and public.generations_last_day() = 1, 'day counters still without it';
      r := t.reserve_done(u, s, mk, 2);
      assert (r->>'ok')::boolean and (r->>'used')::int = 2, 'the refunded lesson can be used: ' || r::text;
      assert public.reserve_generation(u, mk, 2, s, 'liceum', null, '{}', '{}')->>'reason' = 'lifetime', 'then the limit';
    end $$;`);
  });

  await check("release_generation (0009): refuses a done generation and unknown ids (nothing changes); missing arguments raise; usage of the row's own month (UTC)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; x jsonb; g uuid; ok boolean; begin
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      g := (r->>'generation_id')::uuid;
      perform public.finish_generation(g, '{"name":"T","source":"materials","content":{"name":"T"}}', '{"model":"claude-opus-5"}');
      x := public.release_generation(g, 'ai_unavailable');
      assert x = '{"ok": false, "reason": "done"}'::jsonb, x::text;
      assert (select status = 'done' and refunded_at is null from public.generations where id = g), 'a finished lesson is never refunded';
      assert (select generations from public.usage where user_id = u and month = mk) = 1, 'usage unchanged';
      assert (select count(*) from public.generation_ledger where voided_at is null) = 1, 'ledger unchanged';
      x := public.release_generation(gen_random_uuid(), 'ai_unavailable');
      assert x = '{"ok": false, "reason": "not_found"}'::jsonb, x::text;
      begin
        perform public.release_generation(g, '  ');
        ok := false;
      exception when others then ok := sqlerrm like 'release_generation: missing arguments%';
      end;
      assert ok, 'empty reason';
      -- a row reserved at the end of the previous month: the refund goes to that month's usage, this month's stays
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      g := (r->>'generation_id')::uuid;
      update public.generations set created_at = date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' - interval '1 second', status = 'failed' where id = g;
      insert into public.usage (user_id, month, generations) values (u, to_char((date_trunc('month', now() at time zone 'UTC') - interval '1 day'), 'YYYY-MM'), 5);
      x := public.release_generation(g, 'ai_unavailable');
      assert (x->>'usage')::int = 1 and (x->>'ledger')::int = 0, x::text;
      assert (select generations from public.usage where user_id = u and month = to_char((date_trunc('month', now() at time zone 'UTC') - interval '1 day'), 'YYYY-MM')) = 4, 'previous month −1';
      assert (select generations from public.usage where user_id = u and month = mk) = 2, 'this month unchanged';
      -- usage never goes below 0
      update public.usage set generations = 0 where user_id = u;
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      update public.usage set generations = 0 where user_id = u and month = mk;
      x := public.release_generation((r->>'generation_id')::uuid, 'ai_unavailable');
      assert (x->>'usage')::int = 0 and (select generations from public.usage where user_id = u and month = mk) = 0, 'not negative: ' || x::text;
    end $$;`);
  });

  await check("release_generation (0009): a refunded generation frees its place under the global cap (30) and the free pool; the account's daily cap of 20 still counts it (abuse guard)", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); s uuid := t.new_subject(u); v uuid := t.new_user(); sv uuid := t.new_subject(v);
                     mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; x jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '2 hours' from generate_series(1, 29);
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'the 30th: ' || r::text;
      assert public.reserve_generation(v, mk, 150, sv, 'liceum', null, '{}', '{}')->>'reason' = 'global', 'full';
      x := public.release_generation((r->>'generation_id')::uuid, 'ai_unavailable');
      assert (x->>'ok')::boolean, x::text;
      assert (public.generation_quota(v, mk, 150)->>'global_open')::boolean, '/api/me: open again';
      r := public.reserve_generation(v, mk, 150, sv, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'a place again after the refund: ' || r::text;
    end $$;`);
    psql("select t.reset()");
    psqlFile(`do $$ declare f uuid := t.new_free_user(); sf uuid := t.new_subject(f); g uuid := t.new_free_user(); sg uuid := t.new_subject(g);
                     mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; begin
      update public.app_config set value = '1' where key = 'free_global_daily_cap';
      r := public.reserve_generation(f, mk, 2, sf, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      assert public.reserve_generation(g, mk, 2, sg, 'liceum', null, '{}', '{}')->>'reason' = 'global', 'free pool 1 full';
      perform public.release_generation((r->>'generation_id')::uuid, 'ai_unavailable');
      r := public.reserve_generation(g, mk, 2, sg, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'free pool free again: ' || r::text;
    end $$;`);
    psql("select t.reset()");
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); mk text := to_char(now() at time zone 'UTC', 'YYYY-MM'); r jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) select u, 'done', 'liceum', now() - interval '1 hour' from generate_series(1, 19);
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      perform public.release_generation((r->>'generation_id')::uuid, 'ai_unavailable');
      r := public.reserve_generation(u, mk, 150, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "daily", "limit": 20}'::jsonb, 'refunded attempts still count to 20/24 h: ' || r::text;
    end $$;`);
  });

  await check("release_generation (0009) takes the account lock (like reserve_generation): a held lock makes it wait", async () => {
    const u = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    const g = psql(`select public.reserve_generation('${u}', to_char(now() at time zone 'UTC', 'YYYY-MM'), 150, '${s}', 'liceum', null, '{}', '{}')->>'generation_id'`);
    const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:generation:user'), hashtext('${u}')); select pg_sleep(0.6); commit;`);
    await sleep(200);
    const r = await psqlAsync(`set lock_timeout = '150ms'; select public.release_generation('${g}', 'ai_unavailable')`);
    await holder;
    if (r.code === 0 || !/lock timeout/i.test(r.err)) throw new Error(`account lock not taken: ${r.code} ${r.out} ${r.err}`);
    eq(psql(`select refunded_at is null from public.generations where id = '${g}'`), "t", "nothing refunded while waiting");
    eq(psql(`select public.release_generation('${g}', 'ai_unavailable')->>'ok'`), "true", "then it goes through");
  });

  await check("cost view and bucket stats (service role)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); begin
      insert into public.generations (owner_id, status, stage, cost_usd, opus_cache_read) values (u, 'done', 'liceum', 1.5, 10), (u, 'failed', 'liceum', 0.5, 0), (u, 'done', 'liceum', null, null);
      insert into storage.objects (bucket_id, name, metadata) values ('materials', u || '/a.jpg', '{"size": 1000}'), ('materials', u || '/b.jpg', '{"size": 24}');
    end $$;`);
    const row = psql("set role service_role; select generations || '|' || done || '|' || failed || '|' || costed || '|' || cost_usd || '|' || opus_cache_read from public.generation_cost_daily");
    eq(row, "3|2|1|2|2.0000|10", "daily cost row");
    eq(psql("set role service_role; select objects || '|' || bytes || '|' || bytes_24h from public.materials_bucket_stats()"), "2|1024|1024", "bucket stats");
  });

  await check("storage (P1-5): RESTRICTIVE daily cap — 100 objects / 24 h per account, then refused; old files and other buckets unaffected", async () => {
    const a = psql("select t.new_user()");
    const other = psql("select t.new_user()");
    psql(`insert into storage.buckets (id, name) values ('avatars', 'avatars') on conflict do nothing`);
    psql(`create policy "test avatars" on storage.objects for insert with check (bucket_id = 'avatars')`);
    // files from yesterday do not count
    psql(`insert into storage.objects (bucket_id, name, metadata, created_at) select 'materials', '${a}/' || gen_random_uuid() || '.jpg', '{"size": 1000}', now() - interval '25 hours' from generate_series(1, 150)`);
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${a}', false);
      do $$ declare ok boolean; begin
        for i in 1..100 loop
          insert into storage.objects (bucket_id, name, metadata) values ('materials', '${a}/' || gen_random_uuid() || '.jpg', '{"size": 1000}');
        end loop;
        begin
          insert into storage.objects (bucket_id, name, metadata) values ('materials', '${a}/' || gen_random_uuid() || '.jpg', '{"size": 1000}');
          ok := false;
        exception when insufficient_privilege then ok := true;
        end;
        assert ok, 'the 101st upload in 24 h must be refused';
        -- the restrictive policy is limited to the materials bucket
        insert into storage.objects (bucket_id, name) values ('avatars', 'x.png');
        -- another user's folder is still refused by the existing permissive policy
        begin
          insert into storage.objects (bucket_id, name) values ('materials', '${other}/' || gen_random_uuid() || '.jpg');
          ok := false;
        exception when insufficient_privilege then ok := true;
        end;
        assert ok, 'foreign folder';
      end $$;`);
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${other}', false);
      insert into storage.objects (bucket_id, name, metadata) values ('materials', '${other}/' || gen_random_uuid() || '.jpg', '{"size": 1000}');`);
  });

  await check("storage (P1-5): 500 MB per account in 24 h", async () => {
    const b = psql("select t.new_user()");
    psql(`insert into storage.objects (bucket_id, name, metadata) values ('materials', '${b}/' || gen_random_uuid() || '.pdf', '{"size": 524288000}')`);
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${b}', false);
      do $$ declare ok boolean; begin
        begin
          insert into storage.objects (bucket_id, name, metadata) values ('materials', '${b}/' || gen_random_uuid() || '.jpg', '{"size": 10}');
          ok := false;
        exception when insufficient_privilege then ok := true;
        end;
        assert ok, '500 MB already uploaded today';
      end $$;`);
    const c = psql("select t.new_user()");
    psql(`insert into storage.objects (bucket_id, name, metadata) values ('materials', '${c}/' || gen_random_uuid() || '.pdf', '{"size": 524287000}')`);
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${c}', false);
      insert into storage.objects (bucket_id, name, metadata) values ('materials', '${c}/' || gen_random_uuid() || '.jpg', '{"size": 10}');`);
  });

  await check("topics.content < 1 MB (CHECK, NOT VALID: old rows kept); a normal topic passes", async () => {
    const u = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    const fixture = path.join(backendRoot, "../nauka-app/test/fixtures/topic-makro.json");
    const normal = existsSync(fixture) ? readFileSync(fixture, "utf8").replace(/'/g, "''") : '{"name":"x","levels":[]}';
    psql(`insert into public.topics (subject_id, owner_id, name, content) values ('${s}', '${u}', 'Makro', '${normal}'::jsonb)`);
    psqlFile(`do $$ declare ok boolean; begin
      begin
        insert into public.topics (subject_id, owner_id, name, content)
        values ('${s}', '${u}', 'Za duży', (select jsonb_build_object('levels', jsonb_agg(md5(i::text) || md5((i * 7)::text))) from generate_series(1, 20000) i));
        ok := false;
      exception when check_violation then ok := true;
      end;
      assert ok, 'a ~1.3 MB content must be refused';
      assert (select not convalidated from pg_constraint where conname = 'topics_content_size'), 'NOT VALID';
    end $$;`);
    // an oversized row from before the migration survives a re-run of 0008
    psql("alter table public.topics drop constraint topics_content_size");
    psql(`insert into public.topics (subject_id, owner_id, name, content) values ('${s}', '${u}', 'Stary', (select jsonb_build_object('levels', jsonb_agg(md5(i::text) || md5((i * 7)::text))) from generate_series(1, 20000) i))`);
    psqlFile(migration(path.join(migrationsDir, "0008_account_limits.sql")));
    eq(psql(`select count(*) from public.topics where name = 'Stary'`), 1, "old row kept");
    eq(psql(`select count(*) from pg_constraint where conname = 'topics_content_size'`), 1, "constraint back");
  });

  await check("row caps (P1-5): 200 subjects per account; 100 materials and 50 topics per account per 24 h; error 23514", async () => {
    const u = psql("select t.new_user()");
    psqlFile(`do $$ declare u uuid := '${u}'; s uuid; ok boolean; begin
      insert into public.subjects (owner_id, name) select u, 'P' || i from generate_series(1, 200) i;
      begin
        insert into public.subjects (owner_id, name) values (u, 'nadmiarowy');
        ok := false;
      exception when check_violation then ok := sqlerrm = 'subject_limit';
      end;
      assert ok, 'subject 201';
      s := (select id from public.subjects where owner_id = u limit 1);
      insert into public.materials (owner_id, storage_path, mime, created_at) select u, u || '/' || gen_random_uuid() || '.jpg', 'image/jpeg', now() - interval '2 days' from generate_series(1, 120);
      insert into public.materials (owner_id, storage_path, mime) select u, u || '/' || gen_random_uuid() || '.jpg', 'image/jpeg' from generate_series(1, 100);
      begin
        insert into public.materials (owner_id, storage_path, mime) values (u, u || '/' || gen_random_uuid() || '.jpg', 'image/jpeg');
        ok := false;
      exception when check_violation then ok := sqlerrm = 'materials_daily_limit';
      end;
      assert ok, 'material 101 today';
      insert into public.topics (subject_id, owner_id, name, content) select s, u, 'T' || i, '{}' from generate_series(1, 50) i;
      begin
        insert into public.topics (subject_id, owner_id, name, content) values (s, u, 'T51', '{}');
        ok := false;
      exception when check_violation then ok := sqlerrm = 'topics_daily_limit';
      end;
      assert ok, 'topic 51 today';
    end $$;`);
    // another account is not affected; the caps apply to signed-in users through RLS too
    const v = psql("select t.new_user()");
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${v}', false);
      insert into public.subjects (owner_id, name) values ('${v}', 'Chemia');`);
  });

  await check("generations (0008): the owner reads the columns clients use, but not cost / quality / tokens; other accounts' rows stay hidden", async () => {
    const u = psql("select t.new_user()");
    const o = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    const m = "00000000-0000-4000-8000-0000000000aa";
    psql(`insert into public.generations (owner_id, status, stage, subject_id, material_ids, cost_usd, quality, opus_input, model) values ('${u}', 'running', 'liceum', '${s}', '{${m}}', 1.2345, '{"x":1}', 100, 'claude-opus-5')`);
    psql(`insert into public.generations (owner_id, status, stage) values ('${o}', 'running', 'liceum')`);
    // Cramfox build 6/7 recoverJob and generate(): exactly these selects and filters
    const row = psql(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false);
      select count(*) || '|' || max(status::text) from (select id, status, topic_id, error, created_at from public.generations
        where subject_id = '${s}' and material_ids = '{${m}}' and created_at > now() - interval '1 hour' order by created_at desc limit 1) x`);
    eq(row.split("\n").pop(), "1|running", "own row through the client's query");
    eq(psql(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select count(*) from public.generations`).split("\n").pop(), 1, "RLS: only own rows");
    for (const col of ["cost_usd", "quality", "opus_input", "model", "input_tokens", "*"]) {
      let denied = false;
      try {
        psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select ${col} from public.generations;`);
      } catch (e) {
        denied = /permission denied/.test(e.message);
      }
      if (!denied) throw new Error(`authenticated can read generations.${col}`);
    }
    eq(psql(`set role service_role; select cost_usd from public.generations where owner_id = '${u}'`), "1.2345", "service role reads everything");
  });

  /* ---------- D3 / P0-2 (owner decision 2026-10-15): free = 2 generations for life, no trial, configurable caps ---------- */
  await check("no trial for new sign-ups (Cramfox or any other client); a running trial keeps pro until trial_until, then end_trials makes it free", async () => {
    psqlFile(`do $$ declare a uuid; b uuid; c uuid; begin
      insert into auth.users (email, raw_user_meta_data) values ('nowy@test.local', '{"client":"cramfox"}') returning id into a;
      insert into auth.users (email, raw_user_meta_data) values ('web@test.local', '{"client":"web","full_name":"Ola"}') returning id into b;
      assert (select plan = 'free' and trial_until is null and email = 'nowy@test.local' from public.profiles where id = a), 'Cramfox sign-up: free, no trial';
      assert (select plan = 'free' and trial_until is null and display_name = 'Ola' from public.profiles where id = b), 'web sign-up: free, no trial';
      assert exists (select 1 from public.user_meta where user_id = a), 'user_meta row still created';
      c := t.new_user(); -- an account from before 0007, on its trial
      perform public.end_trials();
      assert (select plan = 'pro' from public.profiles where id = c), 'a running trial is not ended';
      update public.profiles set trial_until = now() - interval '1 minute' where id = c;
      perform public.end_trials();
      assert (select plan = 'free' from public.profiles where id = c), 'an ended trial becomes free';
    end $$;`);
  });

  await check("free plan: 2 generations for life — failed ones count, no monthly reset, the 3rd is refused before counting (lifetime)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_free_user('ala@test.local'); s uuid := t.new_subject(u); r jsonb; g uuid; begin
      r := public.reserve_generation(u, '2026-10', 2, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean and r->>'plan' = 'free' and r->>'scope' = 'lifetime' and (r->>'used')::int = 1 and (r->>'limit')::int = 2, r::text;
      g := (r->>'generation_id')::uuid;
      assert (select generation_id = g and user_id = u and email_hash = public.email_hash('ala@test.local') from public.free_generation_ledger), 'ledger row';
      update public.generations set status = 'failed' where id = g; -- charged and failed: still counts
      r := public.reserve_generation(u, '2026-11', 2, s, 'liceum', null, '{}', '{}'); -- another month: no reset
      assert (r->>'ok')::boolean and (r->>'used')::int = 2, r::text;
      update public.generations set status = 'done' where id = (r->>'generation_id')::uuid;
      r := public.reserve_generation(u, '2026-12', 2, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "lifetime", "used": 2, "limit": 2}'::jsonb, r::text;
      r := public.reserve_generation(u, '2026-12', 150, s, 'liceum', null, '{}', '{}');
      assert r->>'reason' = 'lifetime', 'p_monthly_limit does not apply to the free plan: ' || r::text;
      assert (select count(*) from public.free_generation_ledger) = 2 and (select count(*) from public.generations where owner_id = u) = 2, 'refusals change nothing';
      assert (select sum(generations) from public.usage where user_id = u) = 2, 'monthly usage still counted (statistics)';
      assert public.generation_quota(u, '2027-01', 2) = '{"plan": "free", "scope": "lifetime", "used": 2, "limit": 2, "remaining": 0, "trial_until": null, "free_limit": 2, "global_open": true}'::jsonb,
        public.generation_quota(u, '2027-01', 2)::text;
    end $$;`);
  });

  await check("delete account (delete_my_account) + re-register with the same e-mail (other case, spaces) → still at the limit; another address starts at 0", async () => {
    const u = psql("select t.new_free_user('Ola.Nowak@Test.local')");
    const s = psql(`select t.new_subject('${u}')`);
    psqlFile(`do $$ declare r jsonb; begin
      r := t.reserve_done('${u}', '${s}'); assert (r->>'ok')::boolean, r::text;
      r := t.reserve_done('${u}', '${s}'); assert (r->>'ok')::boolean and (r->>'used')::int = 2, r::text;
    end $$;`);
    // the user deletes the account in the app: RPC as the signed-in user, everything else goes by cascade
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select public.delete_my_account(false);`);
    psqlFile(`do $$ declare v uuid; sv uuid; w uuid; sw uuid; r jsonb; begin
      assert not exists (select 1 from auth.users where id = '${u}') and not exists (select 1 from public.generations where owner_id = '${u}'), 'account and its rows deleted';
      assert (select count(*) from public.free_generation_ledger where user_id is null and email_hash = public.email_hash('ola.nowak@test.local')) = 2,
        'the e-mail ledger survives the account (user_id → null)';
      v := t.new_free_user('  OLA.NOWAK@test.local '); sv := t.new_subject(v);
      assert (public.generation_quota(v, '2026-10', 2)->>'remaining')::int = 0, 'quota of the new account: nothing left';
      r := public.reserve_generation(v, '2026-10', 2, sv, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "lifetime", "used": 2, "limit": 2}'::jsonb, 're-registered with the same address: ' || r::text;
      w := t.new_free_user('ola.nowak2@test.local'); sw := t.new_subject(w);
      r := public.reserve_generation(w, '2026-10', 2, sw, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean and (r->>'used')::int = 1, 'another address: ' || r::text;
    end $$;`);
  });

  await check("changing the e-mail in Auth does not reset the count (the account's own rows count by user_id)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_free_user('zmiana@test.local'); s uuid := t.new_subject(u); r jsonb; begin
      r := t.reserve_done(u, s); assert (r->>'ok')::boolean, r::text;
      update auth.users set email = 'zupelnie.nowy@test.local' where id = u;
      r := t.reserve_done(u, s); assert (r->>'ok')::boolean and (r->>'used')::int = 2, 'the row under the old address counts: ' || r::text;
      r := public.reserve_generation(u, '2026-10', 2, s, 'liceum', null, '{}', '{}');
      assert r->>'reason' = 'lifetime', r::text;
    end $$;`);
  });

  await check("trial accounts keep pro (monthly limit, nothing in the e-mail ledger); after the trial the full free 2 (trial generations do not count)", async () => {
    psqlFile(`do $$ declare u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; q jsonb; begin
      r := t.reserve_done(u, s, '2026-10', 150);
      assert (r->>'ok')::boolean and r->>'plan' = 'pro' and r->>'scope' = 'month' and (r->>'used')::int = 1 and (r->>'limit')::int = 150, r::text;
      perform t.reserve_done(u, s, '2026-10', 150);
      r := t.reserve_done(u, s, '2026-10', 150);
      assert (r->>'used')::int = 3, 'three on the trial: ' || r::text;
      assert not exists (select 1 from public.free_generation_ledger), 'trial generations are not free ones';
      q := public.generation_quota(u, '2026-10', 150);
      assert q->>'plan' = 'pro' and q->>'scope' = 'month' and (q->>'used')::int = 3 and (q->>'remaining')::int = 147 and q->>'month' = '2026-10'
        and (q->>'trial_until')::timestamptz > now() and (q->>'free_limit')::int = 2 and (q->>'global_open')::boolean, q::text;
      -- the trial ends (its generations happened before trial_until), the hourly cron moves the account to free
      update public.generations set created_at = now() - interval '1 hour' where owner_id = u;
      update public.profiles set trial_until = now() - interval '1 minute' where id = u;
      perform public.end_trials();
      q := public.generation_quota(u, '2026-10', 2);
      assert q->>'plan' = 'free' and q->>'scope' = 'lifetime' and (q->>'used')::int = 0 and (q->>'remaining')::int = 2, 'after the trial: the full 2 — ' || q::text;
      r := t.reserve_done(u, s, '2026-10', 2);
      assert (r->>'ok')::boolean and r->>'scope' = 'lifetime' and (r->>'used')::int = 1, r::text;
      assert public.backfill_free_generation_ledger() = 0, 'the backfill does not count trial-era generations either';
    end $$;`);
  });

  await check("global cap 30 (app_config) under concurrency: 40 free accounts racing from 0 (free pool switched off) → exactly 30 reservations", async () => {
    psql(`update public.app_config set value = '30' where key = 'free_global_daily_cap'`); // pool = global cap → no separate pool
    const users = Array.from({ length: 40 }, () => {
      const u = psql("select t.new_free_user()");
      return { u, s: psql(`select t.new_subject('${u}')`) };
    });
    const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:generation:global'), 0); select pg_sleep(1.0); commit;`);
    await sleep(250);
    const out = await Promise.all(users.map(({ u, s }) => psqlAsync(`select public.reserve_generation('${u}', '2026-10', 2, '${s}', 'liceum', null, '{}', '{}')->>'reason'`)));
    await holder;
    const errs = out.filter((o) => o.code !== 0);
    if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
    const reasons = out.map((o) => o.out || "ok");
    eq(reasons.filter((r) => r === "ok").length, 30, `30 successes (${reasons.join(",")})`);
    eq(reasons.filter((r) => r === "global").length, 10, "the rest hit the global cap");
    eq(psql("select count(*) from public.generations"), 30, "never over 30 rows");
    eq(psql("select count(*) from public.generation_ledger"), 30, "global ledger");
    eq(psql("select count(*) from public.free_generation_ledger"), 30, "one e-mail ledger row per reservation, none for refusals");
  });

  await check("free pool (app_config, default 20 of the global 30) under concurrency: 25 free accounts → 20; pro accounts still get the other 10; /api/me quota shows it closed", async () => {
    const free = Array.from({ length: 25 }, () => {
      const u = psql("select t.new_free_user()");
      return { u, s: psql(`select t.new_subject('${u}')`) };
    });
    const pro = Array.from({ length: 12 }, () => {
      const u = psql("select t.new_user()");
      return { u, s: psql(`select t.new_subject('${u}')`) };
    });
    const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:generation:global'), 0); select pg_sleep(0.8); commit;`);
    await sleep(250);
    const out = await Promise.all(free.map(({ u, s }) => psqlAsync(`select r->>'reason' || coalesce(':' || (r->>'pool'), '') from public.reserve_generation('${u}', '2026-10', 2, '${s}', 'liceum', null, '{}', '{}') r`)));
    await holder;
    const errs = out.filter((o) => o.code !== 0);
    if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
    const reasons = out.map((o) => o.out || "ok");
    eq(reasons.filter((r) => r === "ok").length, 20, `20 free successes (${reasons.join(",")})`);
    eq(reasons.filter((r) => r === "global:free").length, 5, "the rest hit the free pool");
    const late = psql("select t.new_free_user()");
    const lateS = psql(`select t.new_subject('${late}')`);
    psqlFile(`do $$ declare q jsonb := public.generation_quota('${late}', '2026-10', 150); begin
      assert q->>'scope' = 'lifetime' and (q->>'remaining')::int = 2 and not (q->>'global_open')::boolean, 'free quota: pool full → global_open false: ' || q::text;
      q := public.generation_quota('${pro[0].u}', '2026-10', 150);
      assert (q->>'global_open')::boolean, 'pro quota: the global cap still has room: ' || q::text;
    end $$;`);
    const pr = await Promise.all(pro.map(({ u, s }) => psqlAsync(`select coalesce(public.reserve_generation('${u}', '2026-10', 150, '${s}', 'liceum', null, '{}', '{}')->>'reason', 'ok')`)));
    const pReasons = pr.map((o) => o.out);
    eq(pReasons.filter((r) => r === "ok").length, 10, `pro gets the other 10 (${pReasons.join(",")})`);
    eq(pReasons.filter((r) => r === "global").length, 2, "then the global cap");
    eq(psql("select count(*) from public.generations"), 30, "never over 30 rows");
    eq(psql(`select (public.generation_quota('${pro[0].u}', '2026-10', 150)->>'global_open')`), "false", "pro quota: global cap full");
    eq(psql(`select public.reserve_generation('${late}', '2026-10', 2, '${lateS}', 'liceum', null, '{}', '{}')->>'reason'`), "global", "late free account");
  });

  await check("reset_free_generations: voids an address's rows (count back to 0); a re-run of the backfill / 0007 / 0008 does not bring them back; the free pool still counts them", async () => {
    const u = psql("select t.new_free_user('Reset.Me@test.local')");
    const s = psql(`select t.new_subject('${u}')`);
    psqlFile(`do $$ declare r jsonb; begin
      r := t.reserve_done('${u}', '${s}'); r := t.reserve_done('${u}', '${s}');
      assert (r->>'used')::int = 2, r::text;
      assert public.reserve_generation('${u}', '2026-10', 2, '${s}', 'liceum', null, '{}', '{}')->>'reason' = 'lifetime', 'at the limit';
      assert public.reset_free_generations('  RESET.me@test.local ') = 2, 'two rows voided';
      assert public.reset_free_generations('reset.me@test.local') = 0, 'idempotent';
      assert (public.generation_quota('${u}', '2026-10', 2)->>'remaining')::int = 2, 'quota back to 2';
      assert public.backfill_free_generation_ledger() = 0, 'the backfill does not re-add voided generations';
    end $$;`);
    psqlFile(migration(path.join(migrationsDir, "0007_generation_guards.sql")));
    psqlFile(migration(path.join(migrationsDir, "0008_account_limits.sql")));
    psqlFile(migration(path.join(migrationsDir, "0009_release_generation.sql")));
    psqlFile(`do $$ declare r jsonb; begin
      assert (select count(*) from public.free_generation_ledger where voided_at is null) = 0, 'still voided after re-running 0007, 0008 and 0009';
      assert public.free_generations_last_day() = 2, 'the free pool counts voided rows (the cost was paid)';
      r := t.reserve_done('${u}', '${s}');
      assert (r->>'ok')::boolean and (r->>'used')::int = 1, 'after the reset: ' || r::text;
    end $$;`);
    let refused = false;
    try {
      psql("select public.reset_free_generations('')");
    } catch (e) {
      refused = /empty e-mail/.test(e.message);
    }
    if (!refused) throw new Error("an empty address must be refused (it would void every account without an e-mail)");
  });

  await check("two live accounts with the same normalized e-mail share the free 2: racing in parallel → exactly one gets the last one (e-mail lock)", async () => {
    const a = psql("select t.new_free_user('Ela@Test.local')");
    const sa = psql(`select t.new_subject('${a}')`);
    const b = psql("select t.new_free_user('ela@test.local')");
    const sb = psql(`select t.new_subject('${b}')`);
    eq(psql(`select (t.reserve_done('${a}', '${sa}')->>'used')`), 1, "first one");
    const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:generation:email'), hashtext(public.email_hash('ela@test.local'))); select pg_sleep(0.8); commit;`);
    await sleep(200);
    const out = await Promise.all([[a, sa], [b, sb]].map(([u, s]) => psqlAsync(`select public.reserve_generation('${u}', '2026-10', 2, '${s}', 'liceum', null, '{}', '{}')->>'reason'`)));
    await holder;
    const errs = out.filter((o) => o.code !== 0);
    if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
    const reasons = out.map((o) => o.out || "ok").sort();
    eq(reasons.join(","), "lifetime,ok", "one ok, one lifetime");
    eq(psql("select count(*) from public.free_generation_ledger"), 2, "never over 2 for the address");
  });

  await check("config change takes effect at once (no migration): global cap and free lifetime limit; 0 stops generation; bad values / missing rows → defaults; a re-run of 0007 keeps the owner's values", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); s uuid := t.new_subject(u); f uuid := t.new_free_user(); sf uuid := t.new_subject(f); r jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '1 hour' from generate_series(1, 5);
      update public.app_config set value = '5' where key = 'generation_global_daily_cap';
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 5}'::jsonb, r::text;
      update public.app_config set value = '"6"' where key = 'generation_global_daily_cap'; -- a JSON string works too
      r := t.reserve_done(u, s);
      assert (r->>'ok')::boolean, 'cap 6: ' || r::text;
      update public.app_config set value = '0' where key = 'generation_global_daily_cap';   -- 0 = stop
      r := public.reserve_generation(f, '2026-10', 2, sf, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 0}'::jsonb, 'cap 0 stops everything: ' || r::text;
      update public.app_config set value = '-3' where key = 'generation_global_daily_cap';  -- invalid → default 30
      r := t.reserve_done(f, sf);
      assert (r->>'ok')::boolean, 'invalid value → default 30: ' || r::text;
      delete from public.app_config where key = 'generation_global_daily_cap';               -- missing → default 30
      r := t.reserve_done(f, sf);
      assert (r->>'ok')::boolean and (r->>'used')::int = 2, 'missing row → default 30: ' || r::text;
      r := public.reserve_generation(f, '2026-10', 2, sf, 'liceum', null, '{}', '{}');
      assert r->>'reason' = 'lifetime', r::text;
      update public.app_config set value = '3' where key = 'free_lifetime_generations';
      assert (public.generation_quota(f, '2026-10', 2)->>'remaining')::int = 1, 'the quota follows the config';
      r := t.reserve_done(f, sf);
      assert (r->>'ok')::boolean and (r->>'used')::int = 3 and (r->>'limit')::int = 3, 'raised to 3: ' || r::text;
      update public.app_config set value = '1' where key = 'free_lifetime_generations';
      r := public.reserve_generation(f, '2026-10', 2, sf, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "lifetime", "used": 3, "limit": 1}'::jsonb, 'lowered to 1: ' || r::text;
      update public.app_config set value = '2.5' where key = 'free_lifetime_generations';
      assert public.app_config_int('free_lifetime_generations', 2) = 2, 'a fraction → default';
    end $$;`);
    psql("select t.reset()");
    psqlFile(`do $$ declare f uuid := t.new_free_user(); sf uuid := t.new_subject(f); g uuid := t.new_free_user(); sg uuid := t.new_subject(g); r jsonb; begin
      update public.app_config set value = '1' where key = 'free_global_daily_cap';
      r := t.reserve_done(f, sf);
      assert (r->>'ok')::boolean, 'pool 1: the first free one: ' || r::text;
      r := public.reserve_generation(g, '2026-10', 2, sg, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 1, "pool": "free"}'::jsonb, 'pool 1 full: ' || r::text;
      assert not exists (select 1 from public.free_generation_ledger where user_id = g), 'a refusal is not counted';
      update public.app_config set value = '2' where key = 'free_global_daily_cap';
      r := t.reserve_done(g, sg);
      assert (r->>'ok')::boolean, 'pool raised to 2: ' || r::text;
      delete from public.app_config where key = 'free_global_daily_cap';                     -- missing → default 20
      assert public.app_config_int('free_global_daily_cap', 20) = 20;
      r := t.reserve_done(g, sg);
      assert (r->>'ok')::boolean, 'missing row → default 20: ' || r::text;
    end $$;`);
    psql(`insert into public.app_config (key, value) values ('generation_global_daily_cap', '45') on conflict (key) do update set value = excluded.value`);
    psqlFile(migration(path.join(migrationsDir, "0007_generation_guards.sql")));
    psqlFile(migration(path.join(migrationsDir, "0009_release_generation.sql"))); // always after a re-run of 0007
    eq(psql(`select value::text from public.app_config where key = 'generation_global_daily_cap'`), "45", "0007 re-run keeps the owner's value");
  });

  await check("increment_usage (old backend, until Build 7 is deployed) takes the global cap from app_config and counts generation_ledger", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); begin
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '1 hour' from generate_series(1, 29);
      assert public.increment_usage(u, '2026-10', 'generations') = 1, 'the 30th';
      insert into public.generations (owner_id, status, stage) values (u, 'done', 'liceum'); -- the old route inserts its row after the charge
      assert public.increment_usage(u, '2026-10', 'generations') = 2000000, 'cap 30 → 2000000 (build 6: „Serwer ma dziś bardzo dużo pracy”)';
      update public.app_config set value = '31' where key = 'generation_global_daily_cap';
      assert public.increment_usage(u, '2026-10', 'generations') = 2, 'config raised';
      truncate public.generations;
      insert into public.generation_ledger (created_at) select now() - interval '1 hour' from generate_series(1, 31);
      assert public.increment_usage(u, '2026-10', 'generations') = 2000000, 'generation_ledger counts too';
    end $$;`);
  });
  /* ---------- 0010 (plan-media §3): reels / podcast creation pool, fox chat counter, TTS budget, podcast chapters, media bucket ---------- */
  const m0010 = path.join(migrationsDir, "0010_media.sql");
  if (!existsSync(m0010)) {
    results.push("ok - 0010 # skip (no 0010_media.sql in the migrations directory)");
  } else {
    psqlFile(migration(m0010));
    psqlFile(migration(m0010));
    psqlFile(`
      create function t.reset_media() returns void language sql as $$
        truncate public.media, public.media_ledger, public.fox_usage, public.tts_ledger;
        delete from public.app_config where key in ('free_media_lifetime', 'pro_media_month', 'media_daily_per_user', 'media_global_daily_cap', 'media_global_daily_attempts', 'free_chat_daily', 'pro_chat_daily', 'chat_global_daily_cap', 'tts_global_daily_chars');
        insert into public.app_config (key, value) values ('free_media_lifetime', '3'), ('pro_media_month', '30'), ('media_daily_per_user', '5'), ('media_global_daily_cap', '60'), ('media_global_daily_attempts', '150'),
          ('free_chat_daily', '30'), ('pro_chat_daily', '200'), ('chat_global_daily_cap', '5000'), ('tts_global_daily_chars', '600000');
      $$;
      create function t.new_topic(u uuid, s uuid) returns uuid language sql as $$
        insert into public.topics (subject_id, owner_id, name, content) values (s, u, 'Wykład 1', '{"name":"Wykład 1","levels":[]}') returning id
      $$;
      -- a reservation (series of 5 reels) for a fresh topic of the account; returns the RPC answer
      create function t.reserve(u uuid, p_kind text default 'reels', p_month text default '2026-10', p_id uuid default gen_random_uuid()) returns jsonb language plpgsql as $$
      declare s uuid := t.new_subject(u); tp uuid := t.new_topic(u, s);
      begin
        return public.reserve_media(p_id, u, s, tp, p_kind, '{"types":["czym","kto","mit"],"progress":{"step":"plan","done":0,"total":3}}', p_month, 30);
      end $$;
      -- reserve + mark ready, so the account is not busy
      create function t.reserve_done(u uuid, p_month text default '2026-10') returns jsonb language plpgsql as $$
      declare r jsonb;
      begin
        r := t.reserve(u, 'reels', p_month);
        if (r->>'ok')::boolean then perform public.finish_media((r->'media'->>'id')::uuid, '{"v":1,"kind":"reels","title":"Seria","reels":[]}', '{"model":"m","cost_usd":0.5,"tts_chars":0}'); end if;
        return r;
      end $$;
    `);
    const mcheck = (name, f) => check(name, async () => {
      psql("select t.reset_media()");
      await f();
    });

    await mcheck("0010: applies twice (idempotent); app_config defaults kept on re-run; privileges: RPCs only for service_role, ledgers hidden, media readable only by column", async () => {
      psql(`update public.app_config set value = '7' where key = 'free_media_lifetime'`);
      psqlFile(migration(m0010));
      eq(psql(`select value::text from public.app_config where key = 'free_media_lifetime'`), "7", "owner's value kept");
      psqlFile(`do $$ begin
        assert not has_function_privilege('authenticated', 'public.reserve_media(uuid,uuid,uuid,uuid,text,jsonb,text,int)', 'execute'), 'authenticated reserve_media';
        assert not has_function_privilege('anon', 'public.reserve_media(uuid,uuid,uuid,uuid,text,jsonb,text,int)', 'execute'), 'anon reserve_media';
        assert has_function_privilege('service_role', 'public.reserve_media(uuid,uuid,uuid,uuid,text,jsonb,text,int)', 'execute'), 'service reserve_media';
        assert not has_function_privilege('authenticated', 'public.release_media(uuid,text,jsonb)', 'execute'), 'authenticated release_media';
        assert has_function_privilege('service_role', 'public.release_media(uuid,text,jsonb)', 'execute'), 'service release_media';
        assert not has_function_privilege('authenticated', 'public.finish_media(uuid,jsonb,jsonb)', 'execute'), 'authenticated finish_media';
        assert not has_function_privilege('authenticated', 'public.fail_media(uuid,text,jsonb)', 'execute'), 'authenticated fail_media';
        assert not has_function_privilege('authenticated', 'public.media_quota(uuid,text,int)', 'execute'), 'authenticated media_quota';
        assert not has_function_privilege('authenticated', 'public.claim_podcast_chapter(uuid,uuid,int)', 'execute'), 'authenticated claim';
        assert not has_function_privilege('authenticated', 'public.set_podcast_chapter(uuid,int,jsonb)', 'execute'), 'authenticated set chapter';
        assert not has_function_privilege('authenticated', 'public.release_podcast_chapter(uuid,int,boolean)', 'execute'), 'authenticated release chapter';
        assert to_regprocedure('public.release_podcast_chapter(uuid,int)') is null, 'old 2-argument release_podcast_chapter dropped';
        assert not has_function_privilege('authenticated', 'public.tts_refund(int,uuid,text)', 'execute'), 'authenticated tts_refund';
        assert has_function_privilege('service_role', 'public.tts_refund(int,uuid,text)', 'execute'), 'service tts_refund';
        assert not has_function_privilege('authenticated', 'public.media_busy(uuid)', 'execute'), 'authenticated media_busy';
        assert not has_function_privilege('authenticated', 'public.media_free_used(uuid,text)', 'execute'), 'authenticated media_free_used';
        assert not has_function_privilege('authenticated', 'public.media_attempts_last_day()', 'execute'), 'authenticated media_attempts_last_day';
        assert not has_function_privilege('authenticated', 'public.media_tts_rest(jsonb)', 'execute'), 'authenticated media_tts_rest';
        assert has_function_privilege('authenticated', 'public.delete_my_account(boolean)', 'execute'), 'delete_my_account still callable by the user';
        assert not has_function_privilege('anon', 'public.delete_my_account(boolean)', 'execute'), 'delete_my_account not for anon';
        assert not has_function_privilege('authenticated', 'public.tts_budget(int,uuid,text)', 'execute'), 'authenticated tts_budget';
        assert not has_function_privilege('authenticated', 'public.reserve_chat(uuid)', 'execute'), 'authenticated reserve_chat';
        assert not has_function_privilege('anon', 'public.reserve_chat(uuid)', 'execute'), 'anon reserve_chat';
        assert not has_function_privilege('authenticated', 'public.release_chat(uuid,date)', 'execute'), 'authenticated release_chat';
        assert not has_function_privilege('authenticated', 'public.chat_quota(uuid)', 'execute'), 'authenticated chat_quota';
        assert not has_function_privilege('authenticated', 'public.sweep_stale_media()', 'execute'), 'authenticated sweep';
        assert not has_function_privilege('authenticated', 'public.media_last_day()', 'execute'), 'authenticated media_last_day';
        assert has_function_privilege('service_role', 'public.chat_quota(uuid)', 'execute'), 'service chat_quota';
        assert not has_table_privilege('authenticated', 'public.media_ledger', 'select'), 'media_ledger hidden';
        assert not has_table_privilege('authenticated', 'public.fox_usage', 'select'), 'fox_usage hidden';
        assert not has_table_privilege('anon', 'public.tts_ledger', 'select'), 'tts_ledger hidden';
        assert not has_table_privilege('authenticated', 'public.media', 'insert'), 'no insert';
        assert not has_table_privilege('authenticated', 'public.media', 'update'), 'no update';
        assert not has_table_privilege('authenticated', 'public.media', 'delete'), 'no delete';
        assert not has_table_privilege('anon', 'public.media', 'select'), 'anon select';
        assert has_column_privilege('authenticated', 'public.media', 'manifest', 'select'), 'manifest readable';
        assert not has_column_privilege('authenticated', 'public.media', 'cost_usd', 'select'), 'cost hidden';
        assert not has_column_privilege('authenticated', 'public.media', 'refunded_at', 'select'), 'refunded_at hidden';
        assert (select schedule from cron.job where jobname = 'cramfox-sweep-media') = '*/5 * * * *', 'cron';
        assert (select public = false and file_size_limit = 26214400 and allowed_mime_types = array['audio/mpeg','application/json'] from storage.buckets where id = 'media'), 'bucket';
      end $$;`);
    });

    await mcheck("reserve_media: running row + ledger, client-shaped row; the same id again → existing (no second charge); another account's id → conflict; topic not owned → not_found", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); o uuid := t.new_free_user(); s uuid := t.new_subject(u); tp uuid := t.new_topic(u, s); mid uuid := gen_random_uuid(); r jsonb; m public.media%rowtype; begin
        r := public.reserve_media(mid, u, s, tp, 'reels', '{"types":["czym","kto","mit"],"focusPointId":null,"progress":{"step":"plan","done":0,"total":3}}', '2026-10', 30);
        assert (r->>'ok')::boolean and r->>'scope' = 'lifetime' and (r->>'used')::int = 1 and (r->>'limit')::int = 3, r::text;
        assert r->'media'->>'status' = 'running' and r->'media'->>'kind' = 'reels' and (r->'media'->>'id')::uuid = mid, 'row in the answer';
        assert r->'media'->'progress' = '{"step":"plan","done":0,"total":3}'::jsonb, 'progress';
        assert not (r->'media' ? 'cost_usd') and not (r->'media'->'spec' ? 'progress'), 'client columns only, spec without progress';
        select * into m from public.media x where x.id = mid;
        assert m.owner_id = u and m.subject_id = s and m.topic_id = tp and m.phase = 'plan' and m.charged, 'row';
        assert (select count(*) from public.media_ledger where media_id = mid and scope = 'lifetime' and user_id = u) = 1, 'ledger';
        r := public.reserve_media(mid, u, s, tp, 'reels', '{}', '2026-10', 30);
        assert (r->>'ok')::boolean and (r->>'existing')::boolean and (r->'media'->>'id')::uuid = mid, 'existing: ' || r::text;
        assert (select count(*) from public.media_ledger where user_id = u) = 1, 'not charged twice';
        r := public.reserve_media(mid, o, s, tp, 'reels', '{}', '2026-10', 30);
        assert r = '{"ok": false, "reason": "conflict"}'::jsonb, r::text;
        r := public.reserve_media(gen_random_uuid(), o, s, tp, 'reels', '{}', '2026-10', 30);
        assert r = '{"ok": false, "reason": "not_found"}'::jsonb, 'foreign topic: ' || r::text;
        begin
          perform public.reserve_media(gen_random_uuid(), u, s, tp, 'video', '{}', '2026-10', 30);
          assert false, 'bad kind must raise';
        exception when raise_exception then null;
        end;
      end $$;`);
    });

    await mcheck("busy: one creation at a time (running < 330 s); an older running row does not block; the answer names the running one", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); r jsonb; f1 uuid; begin
        r := t.reserve(u);
        f1 := (r->'media'->>'id')::uuid;
        r := t.reserve(u, 'podcast');
        assert r->>'reason' = 'busy' and (r->'busy'->>'id')::uuid = f1 and r->'busy'->>'kind' = 'reels' and r->'busy'->>'topicId' is not null, r::text;
        assert (select count(*) from public.media where owner_id = u) = 1, 'nothing written';
        update public.media set created_at = now() - interval '331 seconds' where id = f1;
        assert t.reserve(u, 'podcast')->>'reason' = 'busy', 'busy is read from media_ledger, not from the media row';
        update public.media_ledger set created_at = now() - interval '331 seconds' where media_id = f1;
        r := t.reserve(u, 'podcast');
        assert (r->>'ok')::boolean, 'older running row does not block: ' || r::text;
      end $$;`);
    });

    await mcheck("free pool: 3 creations for life (failed ones count, released ones do not); never the lesson generations; daily cap 5 per account counts released too", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); r jsonb; mid uuid; q jsonb; begin
        r := t.reserve_done(u); assert (r->>'used')::int = 1, r::text;
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;
        perform public.fail_media(mid, 'refusal:x', null);                 -- refusal: stays charged
        assert (select charged from public.media x where x.id = mid), 'fail keeps charged';
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;
        assert (r->>'used')::int = 3, 'third: ' || r::text;
        assert (public.release_media(mid, 'ai_unavailable:x')->>'ok')::boolean, 'release';
        q := public.media_quota(u, '2026-10', 30);
        assert (q->>'used')::int = 2 and (q->>'remaining')::int = 1 and q->>'scope' = 'lifetime' and q->>'plan' = 'free', 'quota after release: ' || q::text;
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;            -- the given-back one
        perform public.finish_media(mid, '{"title":"x"}', '{}');
        r := t.reserve(u);
        assert r->>'reason' = 'lifetime' and (r->>'used')::int = 3 and (r->>'limit')::int = 3, '4th refused: ' || r::text;
        assert (select generations from public.usage where user_id = u) is null, 'lesson counters untouched';
        assert public.free_generations_used(u, public.account_email_hash(u)) = 0, 'free lesson ledger untouched';
        -- daily cap: 4 rows of this account today (incl. failed + released); config 4 → refused even with lifetime left
        update public.app_config set value = '10' where key = 'free_media_lifetime';
        update public.app_config set value = '4' where key = 'media_daily_per_user';
        r := t.reserve(u);
        assert r->>'reason' = 'daily' and (r->>'limit')::int = 4, 'daily: ' || r::text;
        q := public.media_quota(u, '2026-10', 30);
        assert (q->>'dailyLeft')::int = 0, 'dailyLeft: ' || q::text;
        update public.media set created_at = now() - interval '25 hours' where owner_id = u;
        update public.media_ledger set created_at = now() - interval '25 hours' where user_id = u;
        r := t.reserve(u);
        assert (r->>'ok')::boolean, 'rolling 24 h: ' || r::text;
      end $$;`);
    });

    await mcheck("pro pool: 30 a month (app_config, falls back to p_pro_limit), counted per p_month; free-era rows do not count for pro and month rows not for free", async () => {
      psqlFile(`do $$ declare u uuid := t.new_user(); r jsonb; q jsonb; begin
        update public.app_config set value = '2' where key = 'pro_media_month';
        update public.app_config set value = '100' where key = 'media_daily_per_user';
        r := t.reserve_done(u); assert r->>'scope' = 'month' and (r->>'limit')::int = 2 and r->>'plan' = 'pro', r::text;
        r := t.reserve_done(u); assert (r->>'used')::int = 2, r::text;
        r := t.reserve(u);
        assert r->>'reason' = 'month' and (r->>'used')::int = 2 and (r->>'limit')::int = 2, 'month: ' || r::text;
        r := t.reserve_done(u, '2026-11');
        assert (r->>'ok')::boolean and (r->>'used')::int = 1, 'next month: ' || r::text;
        delete from public.app_config where key = 'pro_media_month';
        q := public.media_quota(u, '2026-10', 30);
        assert (q->>'limit')::int = 30 and (q->>'used')::int = 2, 'missing config → p_pro_limit: ' || q::text;
        -- trial ends: the month rows do not eat the free 3
        update public.profiles set plan = 'free', trial_until = null where id = u;
        q := public.media_quota(u, '2026-10', 30);
        assert q->>'scope' = 'lifetime' and (q->>'used')::int = 0 and (q->>'remaining')::int = 3, 'free after pro: ' || q::text;
      end $$;`);
    });

    await mcheck("global cap (app_config, default 60): refunded ones free their place; survives account deletion (media_ledger); 0 stops creation; quota shows globalOpen", async () => {
      psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_free_user(); v uuid := t.new_free_user(); r jsonb; mid uuid; begin
        update public.app_config set value = '3' where key = 'media_global_daily_cap';
        update public.app_config set value = '100' where key = 'media_daily_per_user';
        update public.app_config set value = '100' where key = 'pro_media_month';
        perform t.reserve_done(a); perform t.reserve_done(a);
        r := t.reserve(a); mid := (r->'media'->>'id')::uuid;
        r := t.reserve(u);
        assert r->>'reason' = 'busy' or r->>'reason' = 'global', 'sanity: ' || r::text;
        r := t.reserve(u);
        assert r->>'reason' = 'global', 'cap 3 reached: ' || r::text;
        assert not (public.media_quota(u, '2026-10', 30)->>'globalOpen')::boolean, 'quota closed';
        perform public.release_media(mid, 'timeout:x');
        r := t.reserve(u);
        assert (r->>'ok')::boolean, 'refunded place is free again: ' || r::text;
        -- deleting the account that made the others does not reset the cap
        delete from auth.users where id = a;
        assert (select count(*) from public.media) = 1, 'rows gone with the account';
        r := t.reserve(v);
        assert r->>'reason' = 'global', 'ledger survives deletion: ' || r::text;
        update public.app_config set value = '0' where key = 'media_global_daily_cap';
        assert not (public.media_quota(v, '2026-10', 30)->>'globalOpen')::boolean, '0 pauses';
      end $$;`);
    });

    await mcheck("release_media / fail_media: refund in one transaction, idempotent, refuses ready; stats recorded; fail keeps the charge", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); r jsonb; mid uuid; m public.media%rowtype; begin
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;
        r := public.release_media(mid, 'tts_unavailable:401 [req-1]', '{"model":"claude-sonnet-5","cost_usd":0.1234,"tts_chars":900}');
        assert (r->>'ok')::boolean and (r->>'ledger')::int = 1, r::text;
        select * into m from public.media x where x.id = mid;
        assert m.status = 'failed' and not m.charged and m.refunded_at is not null and m.error = 'released:tts_unavailable:401 [req-1]', 'row: ' || row_to_json(m)::text;
        assert m.cost_usd = 0.1234 and m.tts_chars = 900 and m.model = 'claude-sonnet-5', 'stats';
        assert (select voided_at is not null and refunded_at is not null from public.media_ledger where media_id = mid), 'ledger voided';
        assert (select sum(chars) from public.tts_ledger where media_id = mid) = 900, 'spent characters counted for the TTS budget';
        r := public.release_media(mid, 'again');
        assert (r->>'already')::boolean, 'idempotent: ' || r::text;
        assert (select count(*) from public.tts_ledger where media_id = mid) = 1, 'nothing twice';
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;
        assert (public.finish_media(mid, '{"v":1,"kind":"reels","title":"Seria A","reels":[]}', '{"model":"m","cost_usd":0.2,"tts_chars":1200}')->>'ok')::boolean, 'finish';
        select * into m from public.media x where x.id = mid;
        assert m.status = 'ready' and m.title = 'Seria A' and m.finished_at is not null and m.tts_chars = 1200 and m.phase = 'done', 'ready row';
        assert (select count(*) from public.tts_ledger where media_id = mid and kind = 'reel' and chars = 1200) = 1, 'tts ledger on finish';
        assert public.release_media(mid, 'x') = '{"ok": false, "reason": "done"}'::jsonb, 'ready is never refunded';
        assert public.finish_media(mid, '{}', '{}')->>'reason' = 'not_running', 'finish twice';
        assert public.fail_media(mid, 'x', null)->>'reason' = 'not_running', 'fail on ready';
        assert public.release_media(gen_random_uuid(), 'x') = '{"ok": false, "reason": "not_found"}'::jsonb, 'unknown id';
        begin
          perform public.release_media(mid, '  ');
          assert false, 'empty reason must raise';
        exception when raise_exception then null;
        end;
      end $$;`);
    });

    await mcheck("sweep_stale_media: running > 8 min → refunded (timeout:sweeper), fresh untouched; chapter stuck in synth > 5 min → script", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); v uuid := t.new_free_user(); old uuid; fresh uuid; p uuid; r jsonb; n int; begin
        r := t.reserve(u); old := (r->'media'->>'id')::uuid;
        update public.media set created_at = now() - interval '9 minutes' where id = old;
        update public.media_ledger set created_at = now() - interval '9 minutes' where media_id = old;
        r := t.reserve(u); fresh := (r->'media'->>'id')::uuid;
        r := t.reserve(v, 'podcast'); p := (r->'media'->>'id')::uuid;
        perform public.finish_media(p, jsonb_build_object('v',1,'kind','podcast','title','P','chapters', jsonb_build_array(
          jsonb_build_object('n',1,'status','synth','synthAt', now() - interval '6 minutes'),
          jsonb_build_object('n',2,'status','synth','synthAt', now() - interval '1 minute'),
          jsonb_build_object('n',3,'status','ready'))), '{}');
        n := public.sweep_stale_media();
        assert n = 1, 'swept ' || n;
        assert (select status = 'failed' and not charged and error = 'released:timeout:sweeper' from public.media where id = old), 'refunded';
        assert (select status from public.media where id = fresh) = 'running', 'fresh untouched';
        assert (select manifest->'chapters'->0->>'status' = 'script' and not (manifest->'chapters'->0 ? 'synthAt') from public.media where id = p), 'stuck chapter back';
        assert (select manifest->'chapters'->1->>'status' from public.media where id = p) = 'synth', 'recent claim kept';
        assert (select manifest->'chapters'->2->>'status' from public.media where id = p) = 'ready', 'ready kept';
        assert (select count(*) from public.media_ledger where media_id = old and refunded_at is not null and finished_at is not null) = 1, 'ledger refunded';
        assert (select finished_at is null from public.media_ledger where media_id = fresh), 'fresh still open in the ledger';
      end $$;`);
    });

    await mcheck("podcast chapters: claim states (not_found / not_ready / claimed / busy / ready), set + release; 6 parallel claims → exactly one", async () => {
      const u = psql("select t.new_free_user()");
      const o = psql("select t.new_free_user()");
      const p = psql(`select t.reserve('${u}', 'podcast')->'media'->>'id'`);
      psqlFile(`do $$ declare u uuid := '${u}'; o uuid := '${o}'; p uuid := '${p}'; c jsonb; begin
        assert public.claim_podcast_chapter(p, u, 1) = 'not_ready', 'running podcast';
        perform public.finish_media(p, '{"v":1,"kind":"podcast","title":"P","files":{"script":"script.json"},"chapters":[{"n":1,"status":"script","files":null,"durSec":null},{"n":2,"status":"script","files":null,"durSec":null}]}', '{}');
        assert public.claim_podcast_chapter(p, o, 1) = 'not_found', 'another account';
        assert public.claim_podcast_chapter(p, u, 3) = 'not_found', 'out of range';
        assert public.claim_podcast_chapter(p, u, 0) = 'not_found', 'zero';
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim';
        assert public.claim_podcast_chapter(p, u, 1) = 'busy', 'second claim while synthesizing';
        perform public.release_podcast_chapter(p, 1);
        assert (select manifest->'chapters'->0->>'status' from public.media where id = p) = 'script', 'released';
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim again';
        c := public.set_podcast_chapter(p, 1, '{"status":"ready","durSec":191.4,"files":{"audio":"c1.mp3","timing":"c1.json"}}');
        assert c->>'status' = 'ready' and not (c ? 'synthAt') and (c->>'durSec')::numeric = 191.4 and c->'files'->>'audio' = 'c1.mp3', 'set: ' || c::text;
        assert public.claim_podcast_chapter(p, u, 1) = 'ready', 'cached';
        perform public.release_podcast_chapter(p, 1);
        assert (select manifest->'chapters'->0->>'status' from public.media where id = p) = 'ready', 'release does not touch a ready chapter';
        assert public.set_podcast_chapter(p, 9, '{}') is null, 'set out of range';
        update public.media set manifest = jsonb_set(manifest, '{chapters,1,synthAt}', to_jsonb(now() - interval '4 minutes')) || '{}'::jsonb where id = p;
        update public.media set manifest = jsonb_set(manifest, '{chapters,1,status}', '"synth"') where id = p;
        assert public.claim_podcast_chapter(p, u, 2) = 'claimed', 'a synth claim older than 3 min can be taken over';
        perform public.release_podcast_chapter(p, 2);
      end $$;`);
      const out = await Promise.all(Array.from({ length: 6 }, () => psqlAsync(`select public.claim_podcast_chapter('${p}', '${u}', 2)`)));
      const errs = out.filter((x) => x.code !== 0);
      if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
      const states = out.map((x) => x.out).sort();
      eq(states.filter((s) => s === "claimed").length, 1, `one claim (${states.join(",")})`);
      eq(states.filter((s) => s === "busy").length, 5, "the rest busy");
    });

    await mcheck("reserve_media race: 8 parallel sessions of one account → exactly one creation (the rest busy)", async () => {
      const u = psql("select t.new_free_user()");
      const pairs = Array.from({ length: 8 }, () => {
        const s = psql(`select t.new_subject('${u}')`);
        return { s, tp: psql(`select t.new_topic('${u}', '${s}')`) };
      });
      const holder = psqlAsync(`begin; select pg_advisory_xact_lock(hashtext('cramfox:media:user'), hashtext('${u}')); select pg_sleep(0.8); commit;`);
      await sleep(200);
      const out = await Promise.all(pairs.map(({ s, tp }) => psqlAsync(`select coalesce(public.reserve_media(gen_random_uuid(), '${u}', '${s}', '${tp}', 'reels', '{}', '2026-10', 30)->>'reason', 'ok')`)));
      await holder;
      const errs = out.filter((x) => x.code !== 0);
      if (errs.length) throw new Error(errs.map((e) => e.err).join("\n"));
      const reasons = out.map((x) => x.out).sort();
      eq(reasons.filter((r) => r === "ok").length, 1, `one (${reasons.join(",")})`);
      eq(reasons.filter((r) => r === "busy").length, 7, "the rest busy");
      eq(psql(`select count(*) from public.media_ledger where user_id = '${u}'`), 1, "charged once");
    });

    await mcheck("material deleted during a job (review F1): still busy and counted (media_ledger), finish → not_found, release refunds by the ledger, refusal closes it, the sweeper refunds orphans; ready-then-deleted stays charged; the requestId is not reusable", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); s uuid := t.new_subject(u); tp uuid := t.new_topic(u, s); mid uuid := gen_random_uuid(); m2 uuid; r jsonb; q jsonb; begin
        r := public.reserve_media(mid, u, s, tp, 'reels', '{}', '2026-10', 30);
        assert (r->>'ok')::boolean, r::text;
        delete from public.topics where id = tp;
        assert not exists (select 1 from public.media where id = mid), 'row gone with the topic (cascade)';
        r := t.reserve(u, 'podcast');
        assert r->>'reason' = 'busy' and (r->'busy'->>'id')::uuid = mid and r->'busy'->>'kind' = 'reels' and r->'busy'->'topicId' = 'null'::jsonb, 'still busy: ' || r::text;
        q := public.media_quota(u, '2026-10', 30);
        assert (q->'busy'->>'id')::uuid = mid and (q->>'used')::int = 1 and (q->>'dailyLeft')::int = 4, 'quota while the orphan runs: ' || q::text;
        r := public.reserve_media(mid, u, s, t.new_topic(u, s), 'reels', '{}', '2026-10', 30);
        assert r = '{"ok": false, "reason": "conflict"}'::jsonb, 'requestId of a deleted row is not reused: ' || r::text;
        assert public.finish_media(mid, '{"title":"x"}', '{"tts_chars":500}')->>'reason' = 'not_found', 'finish on a deleted row';
        r := public.release_media(mid, 'deleted:topic', '{"tts_chars":500}');
        assert (r->>'ok')::boolean and (r->>'orphan')::boolean, 'orphan release: ' || r::text;
        assert (select voided_at is not null and refunded_at is not null and finished_at is not null from public.media_ledger where media_id = mid), 'ledger refunded and closed';
        assert (select sum(chars) from public.tts_ledger where media_id = mid) = 500, 'spent characters counted for the TTS budget';
        assert (public.release_media(mid, 'again')->>'already')::boolean, 'idempotent';
        q := public.media_quota(u, '2026-10', 30);
        assert q->'busy' = 'null'::jsonb and (q->>'used')::int = 0 and (q->>'dailyLeft')::int = 4, 'after the refund (the attempt still counts for the day): ' || q::text;
        -- ready, then the material deleted: never refunded
        r := t.reserve_done(u); m2 := (r->'media'->>'id')::uuid;
        delete from public.topics where id = (select topic_id from public.media where id = m2);
        assert public.release_media(m2, 'x') = '{"ok": false, "reason": "done"}'::jsonb, 'finished work stays charged';
        assert (public.media_quota(u, '2026-10', 30)->>'used')::int = 1, 'still used';
        -- refusal on a deleted row: closed in the ledger, stays charged
        r := t.reserve(u); m2 := (r->'media'->>'id')::uuid;
        delete from public.subjects where id = (select subject_id from public.media where id = m2);
        r := public.fail_media(m2, 'refusal:x', null);
        assert (r->>'ok')::boolean and (r->>'orphan')::boolean, 'orphan fail: ' || r::text;
        assert (select finished_at is not null and voided_at is null from public.media_ledger where media_id = m2), 'charged, closed';
        -- the sweeper refunds an orphaned reservation nobody closed
        r := t.reserve(u); m2 := (r->'media'->>'id')::uuid;
        delete from public.subjects where id = (select subject_id from public.media where id = m2);
        update public.media_ledger set created_at = now() - interval '9 minutes' where media_id = m2;
        assert public.sweep_stale_media() = 1, 'orphan swept';
        assert (select refunded_at is not null and finished_at is not null from public.media_ledger where media_id = m2), 'orphan refunded';
        assert public.sweep_stale_media() = 0, 'nothing left to sweep';
        -- the daily cap still sees all 4 attempts although every media row is gone
        assert (select count(*) from public.media where owner_id = u) = 0, 'no media rows left';
        update public.app_config set value = '4' where key = 'media_daily_per_user';
        r := t.reserve(u);
        assert r->>'reason' = 'daily', 'deleting materials does not reset the daily cap: ' || r::text;
      end $$;`);
    });

    await mcheck("global attempts cap (media_global_daily_attempts, default 150) counts refunded attempts too; 0 stops creation", async () => {
      psqlFile(`do $$ declare a uuid := t.new_free_user(); b uuid := t.new_free_user(); r jsonb; begin
        update public.app_config set value = '3' where key = 'media_global_daily_attempts';
        r := t.reserve(a); perform public.release_media((r->'media'->>'id')::uuid, 'invalid_output:x');
        r := t.reserve(a); perform public.release_media((r->'media'->>'id')::uuid, 'invalid_output:x');
        r := t.reserve(b); perform public.release_media((r->'media'->>'id')::uuid, 'invalid_output:x');
        assert public.media_last_day() = 0, 'no creation counted (all refunded)';
        r := t.reserve(b);
        assert r->>'reason' = 'global', 'refunded attempts fill the attempts cap: ' || r::text;
        assert not (public.media_quota(b, '2026-10', 30)->>'globalOpen')::boolean, 'quota closed';
        assert (public.media_quota(b, '2026-10', 30)->>'remaining')::int = 3, 'nothing charged';
        update public.app_config set value = '150' where key = 'media_global_daily_attempts';
        assert (t.reserve(b)->>'ok')::boolean, 'open again';
      end $$;`);
    });

    await mcheck("free media pool keyed by the e-mail hash (review F2): delete the account + re-register with the same address → still used; another address starts at 0", async () => {
      const u = psql("select t.new_free_user('Media.Ola@Test.local')");
      psqlFile(`do $$ declare r jsonb; begin
        r := t.reserve_done('${u}'); r := t.reserve_done('${u}');
        assert (r->>'used')::int = 2, r::text;
        assert (select count(*) from public.media_ledger where email_hash = public.email_hash('media.ola@test.local')) = 2, 'hash stored';
      end $$;`);
      psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select public.delete_my_account(false);`);
      psqlFile(`do $$ declare v uuid; w uuid; r jsonb; q jsonb; begin
        assert not exists (select 1 from auth.users where id = '${u}') and (select count(*) from public.media_ledger where user_id is null) = 2, 'ledger survives (user_id → null)';
        v := t.new_free_user('  MEDIA.OLA@test.local ');
        q := public.media_quota(v, '2026-10', 30);
        assert (q->>'used')::int = 2 and (q->>'remaining')::int = 1 and (q->>'dailyLeft')::int = 5, 'same address: ' || q::text;
        r := t.reserve_done(v); assert (r->>'used')::int = 3, r::text;
        r := t.reserve(v); assert r->>'reason' = 'lifetime', 'pool used up: ' || r::text;
        w := t.new_free_user('media.ola2@test.local');
        assert (public.media_quota(w, '2026-10', 30)->>'used')::int = 0, 'another address';
        -- the e-mail changed in Auth: the account's own rows still count (user_id)
        update auth.users set email = 'inny.adres@test.local' where id = v;
        assert (public.media_quota(v, '2026-10', 30)->>'used')::int = 1, 'own rows by user_id';
      end $$;`);
    });

    await mcheck("delete_my_account (replaced in 0010): files left in the media bucket → files_remaining; without them the account goes", async () => {
      const u = psql("select t.new_free_user()");
      psql(`insert into storage.objects (bucket_id, name) values ('media', '${u}/11111111-2222-4333-8444-555555555555/r1.mp3')`);
      let refused = false;
      try {
        psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select public.delete_my_account(false);`);
      } catch (e) {
        refused = /files_remaining/.test(e.message);
      }
      if (!refused) throw new Error("delete_my_account must refuse while media files remain");
      psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select public.delete_my_account(true);`);
      eq(psql(`select count(*) from auth.users where id = '${u}'`), 1, "dry run and refusal keep the account");
      psql(`delete from storage.objects where bucket_id = 'media' and name like '${u}/%'`);
      psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); select public.delete_my_account(false);`);
      eq(psql(`select count(*) from auth.users where id = '${u}'`), 0, "deleted once the files are gone");
    });

    await mcheck("TTS budget bookkeeping (review F3, F4): tts_refund gives back at most what the media reserved; finish / release / fail add only the characters not reserved yet (tts_logged)", async () => {
      psqlFile(`do $$ declare u uuid := t.new_free_user(); m uuid := gen_random_uuid(); r jsonb; mid uuid; begin
        update public.app_config set value = '1000' where key = 'tts_global_daily_chars';
        assert public.tts_budget(600, m, 'chapter'), 'reserve';
        assert public.tts_refund(1000, m, 'chapter') = 600, 'refund capped at what was reserved';
        assert public.tts_refund(10, m, 'chapter') = 0, 'nothing more to give back';
        assert (select sum(chars) from public.tts_ledger) = 0, 'budget whole again';
        assert public.tts_budget(1000, m, 'chapter'), 'the full budget is free again';
        assert public.tts_refund(5, gen_random_uuid(), 'chapter') = 0, 'unknown media';
        begin
          perform public.tts_refund(-1, m, 'chapter');
          assert false, 'negative must raise';
        exception when raise_exception then null;
        end;
        update public.app_config set value = '600000' where key = 'tts_global_daily_chars';
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;
        assert public.tts_budget(700, mid, 'reel'), 'reel reserved before synthesis';
        perform public.finish_media(mid, '{"title":"x"}', '{"tts_chars":1000,"tts_logged":700}');
        assert (select sum(chars) from public.tts_ledger where media_id = mid) = 1000, 'only the rest added on finish';
        assert (select tts_chars from public.media where id = mid) = 1000, 'the row has the total';
        r := t.reserve(u); mid := (r->'media'->>'id')::uuid;
        assert public.tts_budget(400, mid, 'reel'), 'reserved';
        perform public.release_media(mid, 'tts_budget:x', '{"tts_chars":400,"tts_logged":400}');
        assert (select sum(chars) from public.tts_ledger where media_id = mid) = 400, 'release: nothing twice';
      end $$;`);
    });

    await mcheck("podcast chapter failures (review F4): 3 failed recordings in a UTC day → failing (no more paid tries today); a budget refusal is not a failure; a new day or a ready chapter clears it", async () => {
      const u = psql("select t.new_free_user()");
      const p = psql(`select t.reserve('${u}', 'podcast')->'media'->>'id'`);
      psqlFile(`do $$ declare u uuid := '${u}'; p uuid := '${p}'; c jsonb; begin
        perform public.finish_media(p, '{"v":1,"kind":"podcast","title":"P","files":{"script":"script.json"},"chapters":[{"n":1,"status":"script","files":null,"durSec":null}]}', '{}');
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim 1';
        perform public.release_podcast_chapter(p, 1);             -- budget refusal: not a failure
        assert not ((select manifest->'chapters'->0 from public.media where id = p) ? 'fails'), 'no failure counted';
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim 2';
        perform public.release_podcast_chapter(p, 1, true);
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim 3';
        perform public.release_podcast_chapter(p, 1, true);
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim 4';
        perform public.release_podcast_chapter(p, 1, true);
        c := (select manifest->'chapters'->0 from public.media where id = p);
        assert (c->>'fails')::int = 3 and c->>'status' = 'script' and not (c ? 'synthAt'), 'counted: ' || c::text;
        assert public.claim_podcast_chapter(p, u, 1) = 'failing', 'refused after 3 failures today';
        update public.media set manifest = jsonb_set(manifest, '{chapters,0,failDay}', '"2000-01-01"') where id = p;
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'a new day';
        perform public.release_podcast_chapter(p, 1, true);
        c := (select manifest->'chapters'->0 from public.media where id = p);
        assert (c->>'fails')::int = 1 and c->>'failDay' = to_char(now() at time zone 'UTC', 'YYYY-MM-DD'), 'counter restarts: ' || c::text;
        assert public.claim_podcast_chapter(p, u, 1) = 'claimed', 'claim';
        c := public.set_podcast_chapter(p, 1, '{"status":"ready","durSec":10,"files":{"audio":"c1.mp3","timing":"c1.json"}}');
        assert not (c ? 'fails') and not (c ? 'failDay'), 'ready clears the counter: ' || c::text;
      end $$;`);
    });

    await mcheck("fox chat: messages per Warsaw day — free 30 / pro 200 (app_config), refused before counting, release −1 (not below 0), global cap, chat_quota", async () => {
      psqlFile(`do $$ declare f uuid := t.new_free_user(); p uuid := t.new_user(); r jsonb; q jsonb; d date := (now() at time zone 'Europe/Warsaw')::date; begin
        update public.app_config set value = '3' where key = 'free_chat_daily';
        r := public.reserve_chat(f);
        assert (r->>'ok')::boolean and (r->>'used')::int = 1 and (r->>'limit')::int = 3 and (r->>'remaining')::int = 2 and (r->>'day')::date = d, r::text;
        perform public.reserve_chat(f); perform public.reserve_chat(f);
        r := public.reserve_chat(f);
        assert r->>'reason' = 'chat_daily' and (r->>'used')::int = 3, 'limit: ' || r::text;
        assert (select messages from public.fox_usage where user_id = f and day = d) = 3, 'refusal does not count';
        perform public.release_chat(f, d);
        q := public.chat_quota(f);
        assert (q->>'used')::int = 2 and (q->>'remaining')::int = 1 and (q->>'globalOpen')::boolean and (q->>'day')::date = d, 'quota: ' || q::text;
        perform public.release_chat(f); perform public.release_chat(f); perform public.release_chat(f);
        assert (select messages from public.fox_usage where user_id = f and day = d) = 0, 'never below 0';
        -- yesterday does not count today
        insert into public.fox_usage (user_id, day, messages) values (f, d - 1, 3);
        assert (public.reserve_chat(f)->>'ok')::boolean, 'new day';
        -- pro limit
        assert (public.reserve_chat(p)->>'limit')::int = 200, 'pro 200';
        -- global cap
        update public.app_config set value = '2' where key = 'chat_global_daily_cap';
        r := public.reserve_chat(p);
        assert r->>'reason' = 'chat_global', 'global: ' || r::text;
        assert not (public.chat_quota(p)->>'globalOpen')::boolean, 'quota closed';
      end $$;`);
    });

    await mcheck("tts_budget: global characters in a rolling 24 h — refused over the budget (nothing written), older rows ignored; finish/release add spent characters", async () => {
      psqlFile(`do $$ declare m uuid := gen_random_uuid(); begin
        update public.app_config set value = '1000' where key = 'tts_global_daily_chars';
        assert public.tts_budget(600, m, 'chapter'), 'first';
        assert not public.tts_budget(401, m, 'chapter'), 'over';
        assert (select count(*) from public.tts_ledger) = 1, 'refusal writes nothing';
        assert public.tts_budget(400, m, 'chapter'), 'exactly the budget';
        update public.tts_ledger set created_at = now() - interval '25 hours';
        assert public.tts_budget(1000, m, 'reel'), 'yesterday does not count';
        begin
          perform public.tts_budget(10, m, 'video');
          assert false, 'bad kind must raise';
        exception when raise_exception then null;
        end;
      end $$;`);
    });

    await mcheck("RLS on media: the owner reads the client columns of own rows only; cost / refunded_at / select * denied; no insert / update / delete; ledgers unreadable", async () => {
      const u = psql("select t.new_free_user()");
      const o = psql("select t.new_free_user()");
      psql(`select t.reserve_done('${u}')`);
      psql(`select t.reserve_done('${o}')`);
      const asU = (sql) => psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false); ${sql}`).split("\n").pop();
      eq(asU(`select count(*) from (select id, owner_id, subject_id, topic_id, kind, status, phase, progress, title, spec, manifest, error, charged, created_at, finished_at from public.media) x`), 1, "own row only");
      eq(asU(`select count(*) from public.media where owner_id = '${o}'`), 0, "other account's rows hidden");
      for (const sql of [
        "select cost_usd from public.media",
        "select refunded_at from public.media",
        "select * from public.media",
        `insert into public.media (id, owner_id, subject_id, topic_id, kind) select gen_random_uuid(), owner_id, subject_id, topic_id, 'reels' from public.media limit 1`,
        "update public.media set status = 'ready'",
        "delete from public.media",
        "select * from public.media_ledger",
        "select * from public.fox_usage",
        "select * from public.tts_ledger",
        `select public.reserve_media(gen_random_uuid(), '${u}', gen_random_uuid(), gen_random_uuid(), 'reels', '{}', '2026-10', 30)`,
        `select public.reserve_chat('${u}')`,
      ]) {
        let denied = false;
        try {
          asU(sql);
        } catch (e) {
          denied = /permission denied/.test(e.message);
        }
        if (!denied) throw new Error(`authenticated may: ${sql}`);
      }
      eq(psql(`select count(*) from public.media where owner_id = '${u}' and status = 'ready'`), 1, "nothing changed");
    });

    await mcheck("storage bucket media: the owner reads and deletes own files; another account sees nothing; no insert / update for users (only the service role writes)", async () => {
      const u = psql("select t.new_free_user()");
      const o = psql("select t.new_free_user()");
      const id = "11111111-2222-4333-8444-555555555555";
      psql(`insert into storage.objects (bucket_id, name) values ('media', '${u}/${id}/r1.mp3'), ('media', '${u}/${id}/r1.json'), ('media', '${o}/${id}/r1.mp3')`);
      const as = (who, sql) => psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${who}', false); ${sql}`).split("\n").pop();
      eq(as(u, `select count(*) from storage.objects where bucket_id = 'media'`), 2, "own files");
      eq(as(o, `select count(*) from storage.objects where bucket_id = 'media' and name like '${u}/%'`), 0, "foreign files hidden");
      eq(as(o, `with d as (delete from storage.objects where bucket_id = 'media' and name like '${u}/%' returning 1) select count(*) from d`), 0, "cannot delete foreign files");
      eq(as(u, `with d as (delete from storage.objects where bucket_id = 'media' and name = '${u}/${id}/r1.json' returning 1) select count(*) from d`), 1, "deletes own file");
      for (const sql of [`insert into storage.objects (bucket_id, name) values ('media', '${u}/${id}/x.mp3')`, `update storage.objects set name = name || '2' where bucket_id = 'media'`]) {
        let denied = false;
        try {
          const n = as(u, sql.startsWith("update") ? `with x as (${sql} returning 1) select count(*) from x` : sql);
          denied = sql.startsWith("update") && n === "0";
        } catch (e) {
          denied = /row-level security|permission denied/.test(e.message);
        }
        if (!denied) throw new Error(`authenticated may: ${sql}`);
      }
      eq(psql(`select count(*) from storage.objects where bucket_id = 'media'`), 2, "service role sees the rest");
    });

    await mcheck("0010 SECURITY DEFINER functions work under a non-superuser owner with BYPASSRLS (like Supabase's postgres)", async () => {
      psqlFile(`
        do $$ begin if not exists (select 1 from pg_roles where rolname = 'supa_postgres') then create role supa_postgres nologin nosuperuser bypassrls; end if; end $$;
        grant usage on schema public, auth, storage, cron to supa_postgres;
        grant all on all tables in schema public to supa_postgres;
        grant all on all sequences in schema public to supa_postgres;
        grant select on auth.users to supa_postgres;
        grant execute on all functions in schema auth to supa_postgres;
        alter function public.reserve_media(uuid, uuid, uuid, uuid, text, jsonb, text, int) owner to supa_postgres;
        alter function public.finish_media(uuid, jsonb, jsonb) owner to supa_postgres;
        alter function public.release_media(uuid, text, jsonb) owner to supa_postgres;
        alter function public.fail_media(uuid, text, jsonb) owner to supa_postgres;
        alter function public.media_quota(uuid, text, int) owner to supa_postgres;
        alter function public.media_last_day() owner to supa_postgres;
        alter function public.media_row(public.media) owner to supa_postgres;
        alter function public.claim_podcast_chapter(uuid, uuid, int) owner to supa_postgres;
        alter function public.set_podcast_chapter(uuid, int, jsonb) owner to supa_postgres;
        alter function public.release_podcast_chapter(uuid, int, boolean) owner to supa_postgres;
        alter function public.tts_refund(int, uuid, text) owner to supa_postgres;
        alter function public.media_tts_rest(jsonb) owner to supa_postgres;
        alter function public.media_busy(uuid) owner to supa_postgres;
        alter function public.media_free_used(uuid, text) owner to supa_postgres;
        alter function public.media_attempts_last_day() owner to supa_postgres;
        alter function public.account_email_hash(uuid) owner to supa_postgres;
        alter function public.email_hash(text) owner to supa_postgres;
        alter function public.tts_budget(int, uuid, text) owner to supa_postgres;
        alter function public.reserve_chat(uuid) owner to supa_postgres;
        alter function public.release_chat(uuid, date) owner to supa_postgres;
        alter function public.chat_quota(uuid) owner to supa_postgres;
        alter function public.sweep_stale_media() owner to supa_postgres;
        alter function public.app_config_int(text, int) owner to supa_postgres;`);
      const u = psql("select t.new_free_user()");
      const s = psql(`select t.new_subject('${u}')`);
      const tp = psql(`select t.new_topic('${u}', '${s}')`);
      psqlFile(`set role service_role; do $$ declare u uuid := '${u}'; r jsonb; mid uuid; begin
        r := public.reserve_media(gen_random_uuid(), u, '${s}', '${tp}', 'podcast', '{}', '2026-10', 30);
        assert (r->>'ok')::boolean, r::text;
        mid := (r->'media'->>'id')::uuid;
        assert (public.media_quota(u, '2026-10', 30)->>'used')::int = 1, 'quota';
        assert (public.release_media(mid, 'timeout:x', '{"tts_chars":5}')->>'ok')::boolean, 'release';
        assert (public.reserve_chat(u)->>'ok')::boolean, 'chat';
        perform public.release_chat(u);
        assert (public.chat_quota(u)->>'used')::int = 0, 'chat quota';
        assert public.tts_budget(10, mid, 'chapter'), 'tts budget';
        assert public.tts_refund(10, mid, 'chapter') = 10, 'tts refund';
        assert public.sweep_stale_media() = 0, 'sweep';
      end $$;`);
    });
  }

  // LAST (changes function owners): on Supabase the migrations run as `postgres`, which is NOT a superuser (it has BYPASSRLS;
  // storage.objects belongs to supabase_storage_admin). The SECURITY DEFINER functions must work under such an owner.
  await check("SECURITY DEFINER under a non-superuser owner with BYPASSRLS (like Supabase's postgres): reserve, finish, caps, storage cap", async () => {
    psqlFile(`
      do $$ begin if not exists (select 1 from pg_roles where rolname = 'supa_postgres') then create role supa_postgres nologin nosuperuser bypassrls; end if; end $$;
      grant usage on schema public, auth, storage, cron to supa_postgres;
      grant all on all tables in schema public to supa_postgres;
      grant all on all sequences in schema public to supa_postgres;
      grant select on auth.users to supa_postgres;
      grant select on storage.objects to supa_postgres;
      grant all on all tables in schema cron to supa_postgres;
      grant execute on all functions in schema auth to supa_postgres;
      alter function public.reserve_generation(uuid, text, int, uuid, text, text, jsonb, uuid[]) owner to supa_postgres;
      alter function public.finish_generation(uuid, jsonb, jsonb) owner to supa_postgres;
      alter function public.sweep_stale_generations() owner to supa_postgres;
      alter function public.materials_upload_allowed() owner to supa_postgres;
      alter function public.materials_bucket_stats() owner to supa_postgres;
      alter function public.enforce_owner_caps() owner to supa_postgres;
      alter function public.generation_quota(uuid, text, int) owner to supa_postgres;
      alter function public.app_config_int(text, int) owner to supa_postgres;
      alter function public.email_hash(text) owner to supa_postgres;
      alter function public.account_email_hash(uuid) owner to supa_postgres;
      alter function public.free_generations_used(uuid, text) owner to supa_postgres;
      alter function public.backfill_free_generation_ledger() owner to supa_postgres;
      alter function public.increment_usage(uuid, text, text) owner to supa_postgres;
      alter function public.handle_new_user() owner to supa_postgres;
      alter function public.generations_last_day() owner to supa_postgres;
      alter function public.free_generations_last_day() owner to supa_postgres;
      alter function public.reset_free_generations(text) owner to supa_postgres;
      alter function public.release_generation(uuid, text) owner to supa_postgres;
      do $$ begin
        assert (select not rolsuper and rolbypassrls from pg_roles where rolname = 'supa_postgres'), 'role attributes';
        assert (select proowner::regrole::text from pg_proc where proname = 'materials_upload_allowed') = 'supa_postgres', 'owner';
      end $$;`);
    // free plan under that owner: reads auth.users (e-mail hash), app_config and the e-mail ledger; sign-up trigger; quota for /api/me
    const fu = psql("select t.new_free_user('Owner.Test@test.local')");
    const fs = psql(`select t.new_subject('${fu}')`);
    psqlFile(`set role service_role; do $$ declare u uuid := '${fu}'; s uuid := '${fs}'; r jsonb; q jsonb; begin
      assert (select plan = 'free' and trial_until is null from public.profiles where id = u), 'sign-up trigger owned by a non-superuser';
      r := public.reserve_generation(u, '2026-10', 2, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean and r->>'scope' = 'lifetime' and (r->>'used')::int = 1, r::text;
      q := public.generation_quota(u, '2026-10', 2);
      assert q->>'scope' = 'lifetime' and (q->>'remaining')::int = 1 and (q->>'global_open')::boolean, q::text;
      assert (select email_hash from public.free_generation_ledger where user_id = u) = encode(sha256(convert_to('owner.test@test.local', 'UTF8')), 'hex'), 'sha256 hex of the normalized address';
      assert public.increment_usage(u, '2026-10', 'generations') = 2, 'increment_usage under that owner';
    end $$;`);
    const su = psql("select t.new_user()");
    const ss = psql(`select t.new_subject('${su}')`);
    psqlFile(`set role service_role; do $$ declare u uuid := '${su}'; s uuid := '${ss}'; r jsonb; tp jsonb; begin
      r := public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      assert public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}') = '{"ok": false, "reason": "busy"}'::jsonb, 'busy';
      tp := public.finish_generation((r->>'generation_id')::uuid, '{"name":"T","source":"materials","content":{"name":"T"}}', '{"model":"demo"}');
      assert tp->>'name' = 'T', tp::text;
      assert (select count(*) from public.generation_ledger) = 2, 'ledger written (the free reservation above + this one)';
      -- 0009 under that owner: refund a reservation (usage, ledger)
      r := public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      assert (public.release_generation((r->>'generation_id')::uuid, 'ai_unavailable')->>'ok')::boolean, 'release under a non-superuser owner';
      assert (select refunded_at is not null from public.generations where id = (r->>'generation_id')::uuid), 'refunded';
    end $$;`);
    const a = psql("select t.new_user()");
    psql(`insert into storage.objects (bucket_id, name, metadata) select 'materials', '${a}/' || gen_random_uuid() || '.jpg', '{"size": 1000}' from generate_series(1, 100)`);
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${a}', false);
      do $$ declare ok boolean; begin
        begin
          insert into storage.objects (bucket_id, name, metadata) values ('materials', '${a}/' || gen_random_uuid() || '.jpg', '{"size": 1000}');
          ok := false;
        exception when insufficient_privilege then ok := true;
        end;
        assert ok, 'the storage cap must see the caller''s 100 objects under a non-superuser owner';
      end $$;`);
    psqlFile(`set role authenticated; select set_config('request.jwt.claim.sub', '${a}', false);
      do $$ declare ok boolean; begin
        insert into public.subjects (owner_id, name) select '${a}', 'P' || i from generate_series(1, 200) i;
        begin
          insert into public.subjects (owner_id, name) values ('${a}', 'nadmiarowy');
          ok := false;
        exception when check_violation then ok := sqlerrm = 'subject_limit';
        end;
        assert ok, 'subject cap through the trigger owned by a non-superuser';
      end $$;`);
  });
} catch (e) {
  failed++;
  results.push(`not ok - setup\n    ${String(e.message || e).split("\n").join("\n    ")}`);
} finally {
  spawnSync(path.join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], { encoding: "utf8", env });
  if (!keep) rmSync(base, { recursive: true, force: true });
  else console.log(`kept ${base}`);
}

console.log(results.join("\n"));
console.log(`# ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

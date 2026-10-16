#!/usr/bin/env node
/**
 * Migration tests on a THROWAWAY local Postgres (never a real project): starts a temporary cluster, stubs the parts of
 * Supabase the migrations use (auth.users / auth.uid(), storage.objects with RLS, pg_cron's API, the API roles), applies
 * 0001 + Cramfox 0004–0009 (0007, 0008 and 0009 twice: idempotence; 0009 both before and after 0008) and checks the
 * generation guards (AUDYT P0-1, P1-3, P1-4), the refund of a generation the AI failed on our side (0009,
 * release_generation — incident 2026-10-16),
 * the free plan's lifetime generations keyed by the e-mail hash (and their reset), no trial for new accounts, the
 * configurable global cap with its free pool (D3 / P0-2, owner decision 2026-10-15) and the account limits (P1-5),
 * including real parallel sessions racing for a reservation.
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

#!/usr/bin/env node
/**
 * Migration tests on a THROWAWAY local Postgres (never a real project): starts a temporary cluster, stubs the parts of
 * Supabase the migrations use (auth.users / auth.uid(), storage.objects with RLS, pg_cron's API, the API roles), applies
 * 0001 + Cramfox 0004–0008 (0007 and 0008 twice: idempotence) and checks the generation guards (AUDYT P0-1, P1-3, P1-4)
 * and the account limits (P1-5), including real parallel sessions racing for a reservation.
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
for (const f of ["0004_cramfox.sql", "0005_materials_50mb.sql", "0006_pptx.sql", "0007_generation_guards.sql", "0008_account_limits.sql"])
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
  for (const f of ["0004_cramfox.sql", "0005_materials_50mb.sql", "0006_pptx.sql", "0007_generation_guards.sql", "0008_account_limits.sql", "0007_generation_guards.sql", "0008_account_limits.sql"])
    psqlFile(migration(path.join(migrationsDir, f)));
  results.push("ok - migrations 0001, 0004–0008 apply; 0007 and 0008 apply a second time (idempotent)");

  psqlFile(`
    create schema t;
    create function t.reset() returns void language sql as $$
      truncate public.generations, public.generation_ledger, public.usage, public.topics, public.materials, public.subjects, storage.objects cascade;
    $$;
    create function t.new_user() returns uuid language sql as $$
      insert into auth.users (email, raw_user_meta_data) values (gen_random_uuid() || '@test.local', '{"client":"cramfox"}') returning id
    $$;
    create function t.new_subject(u uuid) returns uuid language sql as $$
      insert into public.subjects (owner_id, name) values (u, 'Biologia') returning id
    $$;
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

  await check("global cap 300 in 24 h for the whole server", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); s uuid := t.new_subject(u); r jsonb; begin
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '2 hours' from generate_series(1, 300);
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 300}'::jsonb, r::text;
      assert not exists (select 1 from public.usage where user_id = u);
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

  await check("race (P0-1): 10 accounts in parallel at 299/300 globally → exactly one gets through", async () => {
    const filler = psql("select t.new_user()");
    psql(`insert into public.generations (owner_id, status, stage) select '${filler}', 'done', 'liceum' from generate_series(1, 299)`);
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
    eq(psql("select count(*) from public.generations"), 300, "never over 300");
  });

  await check("global cap survives account deletion: generation_ledger has no link to auth.users (deleting accounts does not reset 300/24 h)", async () => {
    psqlFile(`do $$ declare a uuid := t.new_user(); u uuid := t.new_user(); s uuid := t.new_subject(u); v uuid := t.new_user(); sv uuid := t.new_subject(v); r jsonb; begin
      -- 299 earlier reservations of an account that is then deleted (as by delete_my_account)
      insert into public.generations (owner_id, status, stage, created_at) select a, 'done', 'liceum', now() - interval '3 hours' from generate_series(1, 299);
      insert into public.generation_ledger (created_at) select now() - interval '3 hours' from generate_series(1, 299);
      r := public.reserve_generation(u, '2026-10', 150, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, 'the 300th is allowed: ' || r::text;
      assert (select count(*) from public.generation_ledger) = 300, 'every reservation is in the ledger';
      delete from auth.users where id in (a, u);
      assert (select count(*) from public.generations) = 0, 'rows gone with the accounts (cascade)';
      r := public.reserve_generation(v, '2026-10', 150, sv, 'liceum', null, '{}', '{}');
      assert r = '{"ok": false, "reason": "global", "limit": 300}'::jsonb, 'cap still reached after deleting the accounts: ' || r::text;
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

  await check("reserve_generation takes the account lock and the global lock (a held lock makes it wait)", async () => {
    const u = psql("select t.new_user()");
    const s = psql(`select t.new_subject('${u}')`);
    for (const [label, key] of [
      ["account", `hashtext('cramfox:generation:user'), hashtext('${u}')`],
      ["global", `hashtext('cramfox:generation:global'), 0`],
    ]) {
      const holder = psqlAsync(`begin; select pg_advisory_xact_lock(${key}); select pg_sleep(0.6); commit;`);
      await sleep(200);
      const r = await psqlAsync(`set lock_timeout = '150ms'; select public.reserve_generation('${u}', '2026-10', 150, '${s}', 'liceum', null, '{}', '{}')`);
      await holder;
      if (r.code === 0 || !/lock timeout/i.test(r.err)) throw new Error(`${label} lock not taken: ${r.code} ${r.out} ${r.err}`);
    }
    eq(psql(`select count(*) from public.generations where owner_id = '${u}'`), 0, "nothing reserved while waiting");
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

  await check("handle_new_user from 0004 still runs (trial for Cramfox sign-ups)", async () => {
    const u = psql("select t.new_user()");
    eq(psql(`select plan || '|' || (trial_until > now() + interval '29 days') from public.profiles where id = '${u}'`), "pro|true", "profile");
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
      do $$ begin
        assert (select not rolsuper and rolbypassrls from pg_roles where rolname = 'supa_postgres'), 'role attributes';
        assert (select proowner::regrole::text from pg_proc where proname = 'materials_upload_allowed') = 'supa_postgres', 'owner';
      end $$;`);
    const su = psql("select t.new_user()");
    const ss = psql(`select t.new_subject('${su}')`);
    psqlFile(`set role service_role; do $$ declare u uuid := '${su}'; s uuid := '${ss}'; r jsonb; tp jsonb; begin
      r := public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}');
      assert (r->>'ok')::boolean, r::text;
      assert public.reserve_generation(u, '2026-10', 3, s, 'liceum', null, '{}', '{}') = '{"ok": false, "reason": "busy"}'::jsonb, 'busy';
      tp := public.finish_generation((r->>'generation_id')::uuid, '{"name":"T","source":"materials","content":{"name":"T"}}', '{"model":"demo"}');
      assert tp->>'name' = 'T', tp::text;
      assert (select count(*) from public.generation_ledger) = 1, 'ledger written';
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

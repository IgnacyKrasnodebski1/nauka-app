#!/usr/bin/env node
/**
 * Smoke test: starts `next start` on a free port (no env → demo mode), hits key routes, exits non-zero on failure.
 * Run after `npm run build`.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(path.dirname(createRequire(import.meta.url).resolve("next/package.json")), "dist", "bin", "next");
const port = await new Promise((res) => {
  const s = net.createServer();
  s.listen(0, () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), NODE_ENV: "production" };
// Default: force demo mode (no secrets). SMOKE_KEEP_ENV=1 keeps whatever env is set (e.g. to test the "configured" path).
if (!process.env.SMOKE_KEEP_ENV) for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "ANTHROPIC_API_KEY"]) delete env[k];
const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const wait = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + "/api/me");
      if (r.status) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start:\n" + log);
};

const checks = [
  { path: "/", expect: (r, body) => r.status === 200 && body.includes("NAUKA") },
  { path: "/login", expect: (r, body) => r.status === 200 && body.includes("Zaloguj") },
  { path: "/app", expect: (r, body) => r.status === 200 && body.includes("Biblioteka") },
  { path: "/app/s/makro", expect: (r, body) => r.status === 200 && body.includes("Makro") },
  { path: "/app/s/makro/l/l1", expect: (r, body) => r.status === 200 && body.includes("lessonhead") },
  { path: "/app/new", expect: (r) => r.status === 200 },
  { path: "/app/account", expect: (r) => r.status === 200 },
  { path: "/regulamin", expect: (r) => r.status === 200 },
  { path: "/prywatnosc", expect: (r) => r.status === 200 },
  { path: "/manifest.webmanifest", expect: (r, body) => r.status === 200 && body.includes("NAUKA") },
  { path: "/api/me", expect: (r, body) => (r.status === 401 || r.status === 503) && r.headers.get("content-type")?.includes("application/json") && JSON.parse(body).error },
  { path: "/api/generate", method: "POST", body: "{}", expect: (r, body) => (r.status === 401 || r.status === 503) && JSON.parse(body).error },
  { path: "/api/tutor", method: "POST", body: "{}", expect: (r, body) => (r.status === 401 || r.status === 503) && JSON.parse(body).error },
  { path: "/api/stripe/checkout", method: "POST", body: "{}", expect: (r, body) => (r.status === 401 || r.status === 503) && JSON.parse(body).error },
  { path: "/api/stripe/webhook", method: "POST", body: "{}", expect: (r) => r.status === 503 || r.status === 400 },
  { path: "/nie-ma-takiej", expect: (r) => r.status === 404 },
];

let failed = 0;
try {
  await wait();
  for (const c of checks) {
    const r = await fetch(base + c.path, { method: c.method ?? "GET", body: c.body, headers: c.body ? { "content-type": "application/json" } : undefined });
    const body = await r.text();
    let ok = false;
    try {
      ok = !!c.expect(r, body);
    } catch {}
    console.log(`${ok ? "PASS" : "FAIL"} ${c.method ?? "GET"} ${c.path} → ${r.status}`);
    if (!ok) failed++;
  }
} catch (e) {
  console.error(e);
  failed++;
} finally {
  child.kill("SIGTERM");
}
if (failed) {
  console.error(`\n${failed} check(s) failed\n--- server log ---\n${log}`);
  process.exit(1);
}
console.log("\nsmoke OK");

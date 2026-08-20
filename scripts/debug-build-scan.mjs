import { existsSync, readFileSync, readdirSync, appendFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOG_PATH = join(ROOT, "debug-dc9808.log");
const SESSION = "dc9808";
const ENDPOINT = "http://127.0.0.1:7653/ingest/b95a8c87-326d-496a-8bbf-ad6c9410be8d";

function log(hypothesisId, location, message, data) {
  // #region agent log
  const payload = {
    sessionId: SESSION,
    runId: process.env.DEBUG_RUN_ID || "pre-fix",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  const line = JSON.stringify(payload);
  appendFileSync(LOG_PATH, line + "\n");
  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION,
    },
    body: line,
  }).catch(() => {});
  console.log(`[${hypothesisId}] ${message}`, data);
  // #endregion
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const require = createRequire(import.meta.url);

let betterAuthResolve = null;
try {
  betterAuthResolve = require.resolve("better-auth");
} catch (e) {
  betterAuthResolve = { error: e.code || String(e) };
}

log("A", "scripts/debug-build-scan.mjs", "better-auth package presence", {
  inPackageJson: Boolean(deps["better-auth"]),
  resolve: betterAuthResolve,
});

const leftoverAuthFiles = [
  "src/lib/auth.ts",
  "src/lib/auth-client.ts",
  "src/app/api/auth/[...better-auth]/route.ts",
  "src/app/_lib/auth/issue-verification-email.ts",
  "proxy.ts",
].map((rel) => ({ rel, exists: existsSync(join(ROOT, rel)) }));

log("A", "scripts/debug-build-scan.mjs", "leftover better-auth entry files", {
  leftoverAuthFiles,
});

const importHits = [];
for (const file of walk(ROOT)) {
  if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (text.includes("better-auth") || text.includes("from \"@/lib/auth\"") || text.includes("from '@/lib/auth'")) {
    importHits.push(relative(ROOT, file).replaceAll("\\", "/"));
  }
}

log("A", "scripts/debug-build-scan.mjs", "files mentioning better-auth or @/lib/auth", {
  count: importHits.length,
  importHits,
});

const dal = readFileSync(join(ROOT, "src/lib/dal.ts"), "utf8");
log("B", "src/lib/dal.ts", "dal.ts auth import graph", {
  importsLibAuth: /from ["']@\/lib\/auth["']/.test(dal),
  importsSupabaseCreateClient: dal.includes('from "@/utils/supabase/server"'),
});

const serverTs = readFileSync(join(ROOT, "src/utils/supabase/server.ts"), "utf8");
const indexTs = readFileSync(join(ROOT, "src/utils/supabase/index.ts"), "utf8");
const createServerClientImporters = [];
for (const file of walk(join(ROOT, "src"))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (text.includes('from "@/utils/supabase/server"') && text.includes("createServerClient")) {
    createServerClientImporters.push(relative(ROOT, file).replaceAll("\\", "/"));
  }
}

log("C", "src/utils/supabase/server.ts", "createServerClient export mismatch", {
  serverExportsCreateClient: /export const createClient/.test(serverTs),
  serverExportsCreateServerClient: /export (const|function|async function) createServerClient/.test(serverTs),
  indexReexportsCreateServerClient: indexTs.includes("createClient as createServerClient"),
  createServerClientImporters,
});

const sqlFiles = walk(join(ROOT, "supabase")).filter((f) => f.endsWith(".sql"));
const invalidComments = [];
const concurrentIndexInTxn = [];
for (const file of sqlFiles) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (/COMMENT ON TABLE IF EXISTS/i.test(text)) {
    invalidComments.push(rel);
  }
  if (/BEGIN;/i.test(text) && /CREATE INDEX CONCURRENTLY/i.test(text)) {
    concurrentIndexInTxn.push(rel);
  }
}

log("D", "supabase/migrations", "invalid COMMENT ON TABLE IF EXISTS", {
  invalidComments,
});

log("E", "supabase/migrations", "CREATE INDEX CONCURRENTLY inside transaction", {
  concurrentIndexInTxn,
});

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DEV_CACHE_MAX_BYTES = 200 * 1024 * 1024;
const PROJECT_ROOT = path.resolve(process.cwd());
const PROJECT_ROOT_NORM = PROJECT_ROOT.toLowerCase().replaceAll("\\", "/");
const SELF_PID = process.pid;
const PARENT_PID = process.ppid;

function dirSizeBytes(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

function listNodeProcesses() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
      { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    ).trim();
    if (!out) return [];
    const parsed = JSON.parse(out);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => ({
      pid: Number(p.ProcessId),
      cmd: typeof p.CommandLine === "string" ? p.CommandLine : "",
    }));
  } catch {
    return [];
  }
}

function isProjectNextProcess(cmd) {
  const normalized = cmd.toLowerCase().replaceAll("\\", "/");
  if (!normalized.includes(PROJECT_ROOT_NORM)) return false;
  return (
    normalized.includes("next/dist/bin/next") ||
    normalized.includes("next/dist/server/lib/start-server") ||
    normalized.includes(".next/dev/build/") ||
    (normalized.includes("npm-cli.js") && normalized.includes("run dev"))
  );
}

function killPid(pid) {
  if (pid === SELF_PID || pid === PARENT_PID) return false;
  try {
    execSync(`taskkill /PID ${pid} /T /F`, {
      encoding: "utf8",
      windowsHide: true,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function pidsOnPort(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: "utf8", windowsHide: true },
    );
    return out
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

const nextDir = path.join(PROJECT_ROOT, ".next");
const devDir = path.join(nextDir, "dev");
const devDirSizeBytes = dirSizeBytes(devDir);

if (devDirSizeBytes > DEV_CACHE_MAX_BYTES && fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
  console.warn(
    "[dev-preflight] Cache dev Turbopack troppo grande: .next/dev rimossa.",
  );
}

const projectNext = listNodeProcesses().filter(
  (p) =>
    isProjectNextProcess(p.cmd) &&
    p.pid !== SELF_PID &&
    p.pid !== PARENT_PID,
);

if (projectNext.length > 0) {
  let killed = 0;
  for (const proc of projectNext) {
    if (killPid(proc.pid)) killed += 1;
  }
  if (killed > 0) {
    console.warn(
      `[dev-preflight] Chiusi ${killed} processi Next/npm orfani di questo progetto.`,
    );
  }
}

for (const pid of pidsOnPort(3000)) {
  if (killPid(pid)) {
    console.warn(`[dev-preflight] Liberata la porta 3000 (PID ${pid}).`);
  }
}

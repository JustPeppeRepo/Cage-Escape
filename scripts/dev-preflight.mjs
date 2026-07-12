import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DEV_CACHE_MAX_BYTES = 200 * 1024 * 1024;

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

function countNodeProcesses() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /NH', {
      encoding: "utf8",
    });
    return out.split("\n").filter((line) => line.includes("node.exe")).length;
  } catch {
    return -1;
  }
}

const nextDir = path.join(process.cwd(), ".next");
const devDir = path.join(nextDir, "dev");
const devDirSizeBytes = dirSizeBytes(devDir);

if (devDirSizeBytes > DEV_CACHE_MAX_BYTES && fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
  console.warn(
    "[dev-preflight] Cache dev Turbopack corrotta o troppo grande: .next/dev rimossa automaticamente.",
  );
}

const nodeProcessCount = countNodeProcesses();
if (nodeProcessCount > 3) {
  console.warn(
    `[dev-preflight] Rilevati ${nodeProcessCount} processi node.exe. Chiudi altri 'npm run dev' o build in corso per evitare panic Turbopack.`,
  );
}

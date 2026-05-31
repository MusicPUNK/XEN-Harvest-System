import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { WorkbookRow } from "./models.ts";

export function readWorkbookRows(filePath: string): WorkbookRow[] {
  const scriptPath = fileURLToPath(new URL("../scripts/read_xlsx.py", import.meta.url));
  const python = resolvePython();
  const result = spawnSync(python, [scriptPath, filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`read_xlsx.py failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout) as WorkbookRow[];
}

function resolvePython(): string {
  if (process.env.PYTHON) {
    return process.env.PYTHON;
  }
  return "python3";
}

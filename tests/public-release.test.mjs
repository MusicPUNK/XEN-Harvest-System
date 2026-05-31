import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const forbiddenPatterns = [
  /\/Users\/admin/,
  new RegExp(["XEN", "铸造记录"].join("")),
  new RegExp(["XEN", "复投执行计划"].join("")),
];

test("tracked release files do not contain private workspace identifiers", () => {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((file) => !file.startsWith("../"));

  const matches = [];
  for (const file of files) {
    if (!existsSync(file)) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) {
        matches.push(`${file}: ${pattern}`);
      }
    }
  }

  assert.deepEqual(matches, []);
});

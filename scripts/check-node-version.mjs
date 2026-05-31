import { pathToFileURL } from "node:url";

export const MIN_NODE_VERSION = "22.22.0";

export function parseNodeVersion(version) {
  const match = String(version).trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unable to parse Node.js version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareVersions(left, right) {
  const a = parseNodeVersion(left);
  const b = parseNodeVersion(right);
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] > b[key]) {
      return 1;
    }
    if (a[key] < b[key]) {
      return -1;
    }
  }
  return 0;
}

export function assertSupportedNodeVersion(version = process.version) {
  if (compareVersions(version, MIN_NODE_VERSION) < 0) {
    throw new Error(
      `Node.js >=${MIN_NODE_VERSION} is required for XEN 一键收菜系统. Current runtime is ${version}.`,
    );
  }
}

function isDirectRun() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectRun()) {
  try {
    assertSupportedNodeVersion();
  } catch (error) {
    console.error((error).message);
    process.exitCode = 1;
  }
}

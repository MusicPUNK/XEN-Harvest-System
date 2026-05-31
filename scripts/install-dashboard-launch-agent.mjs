#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir, userInfo } from "node:os";
import { fileURLToPath } from "node:url";

import { assertSupportedNodeVersion } from "./check-node-version.mjs";
import {
  DASHBOARD_LAUNCH_AGENT_LABEL,
  buildDashboardLaunchAgentPlist,
  dashboardLaunchAgentPath,
} from "../src/launch-agent.ts";

assertSupportedNodeVersion();

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(rootDir, "data");
const serviceScript = resolve(rootDir, "bin/xen-dashboard-service.mjs");
const [command = "install", ...args] = process.argv.slice(2);
const port = Number(readArg(args, "port") ?? process.env.PORT ?? 4173);
const plistPath = dashboardLaunchAgentPath(homedir());
const launchDomain = `gui/${userInfo().uid}`;
const serviceTarget = `${launchDomain}/${DASHBOARD_LAUNCH_AGENT_LABEL}`;

if (process.platform !== "darwin") {
  throw new Error("LaunchAgent installation is only available on macOS.");
}

if (command === "install") {
  install();
} else if (command === "uninstall") {
  uninstall();
} else if (command === "status") {
  status();
} else {
  throw new Error("Usage: node scripts/install-dashboard-launch-agent.mjs install|uninstall|status [--port 4173]");
}

function install() {
  mkdirSync(dirname(plistPath), { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  stopDetachedSupervisor();
  writeFileSync(plistPath, buildDashboardLaunchAgentPlist({
    rootDir,
    nodePath: process.execPath,
    port,
  }));
  runLaunchctl(["bootout", launchDomain, plistPath], { allowFailure: true });
  runLaunchctl(["bootstrap", launchDomain, plistPath]);
  runLaunchctl(["enable", serviceTarget], { allowFailure: true });
  runLaunchctl(["kickstart", "-k", serviceTarget], { allowFailure: true });
  console.log(`Installed ${DASHBOARD_LAUNCH_AGENT_LABEL}`);
  console.log(`Plist: ${plistPath}`);
  console.log(`URL: http://127.0.0.1:${port}`);
}

function uninstall() {
  runLaunchctl(["bootout", launchDomain, plistPath], { allowFailure: true });
  stopDetachedSupervisor();
  if (existsSync(plistPath)) {
    rmSync(plistPath, { force: true });
  }
  console.log(`Uninstalled ${DASHBOARD_LAUNCH_AGENT_LABEL}`);
}

function status() {
  console.log(`Plist: ${existsSync(plistPath) ? plistPath : "not installed"}`);
  runLaunchctl(["print", serviceTarget], { allowFailure: true });
}

function stopDetachedSupervisor() {
  spawnSync(process.execPath, [serviceScript, "stop", "--port", String(port)], {
    cwd: rootDir,
    stdio: "ignore",
  });
}

function runLaunchctl(args, options = {}) {
  const result = spawnSync("launchctl", args, { encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error([
      `launchctl ${args.join(" ")} failed with exit ${result.status}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ].filter(Boolean).join("\n"));
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr && !options.allowFailure) {
    process.stderr.write(result.stderr);
  }
  return result;
}

function readArg(args, key) {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : null;
}

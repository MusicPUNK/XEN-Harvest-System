#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertSupportedNodeVersion } from "../scripts/check-node-version.mjs";

assertSupportedNodeVersion();

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(rootDir, "data");
const serviceName = "xen-dashboard-4173";
const pidFile = resolve(dataDir, `${serviceName}.pid`);
const logFile = resolve(dataDir, `${serviceName}.log`);
const dashboardScript = resolve(rootDir, "bin/xen-dashboard.mjs");
const scriptPath = fileURLToPath(import.meta.url);

const [command = "status", ...args] = process.argv.slice(2);
const port = Number(readArg(args, "port") ?? process.env.PORT ?? 4173);

mkdirSync(dataDir, { recursive: true });

if (command === "start") {
  await startService(port);
} else if (command === "run") {
  await runSupervisor(port);
} else if (command === "stop") {
  await stopService({ port });
} else if (command === "restart") {
  await stopService({ quiet: true, port });
  killKnownDashboardProcesses(port);
  await waitForPortClosed(port, 5000);
  await startService(port);
} else if (command === "status") {
  await printStatus(port);
} else {
  throw new Error(`Usage: node bin/xen-dashboard-service.mjs start|stop|restart|status [--port ${port}]`);
}

async function startService(port) {
  const pid = readPid();
  if (pid && pidAlive(pid)) {
    console.log(`Dashboard service already running. supervisorPid=${pid}`);
    return;
  }
  rmStalePid();
  const supervisorPid = dashboardSupervisors(port)[0] ?? null;
  if (supervisorPid) {
    writeFileSync(pidFile, `${supervisorPid}\n`);
    console.log(`Dashboard service already running. supervisorPid=${supervisorPid}`);
    return;
  }
  if (await canConnect(port)) {
    throw new Error(`Port ${port} is already in use by another process.`);
  }
  const child = spawn(process.execPath, [scriptPath, "run", "--port", String(port)], {
    cwd: rootDir,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
    },
  });
  child.unref();
  console.log(`Dashboard service started on http://127.0.0.1:${port}`);
  console.log(`Log: ${logFile}`);
}

async function runSupervisor(port) {
  writeFileSync(pidFile, `${process.pid}\n`);
  let stopping = false;
  let child = null;

  const stop = () => {
    stopping = true;
    if (child && pidAlive(child.pid)) {
      child.kill("SIGTERM");
    }
    rmStalePid();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  while (!stopping) {
    const logFd = openSync(logFile, "a");
    writeLog(logFd, `starting dashboard on port ${port}`);
    child = spawn(process.execPath, [dashboardScript, "--port", String(port)], {
      cwd: rootDir,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        PORT: String(port),
      },
    });
    const exit = await waitForExit(child);
    writeLog(logFd, `dashboard exited code=${exit.code ?? ""} signal=${exit.signal ?? ""}`);
    closeSync(logFd);
    child = null;
    if (!stopping) {
      await sleep(1500);
    }
  }
}

async function stopService(options = {}) {
  const pid = readPid();
  if (!pid || !pidAlive(pid)) {
    rmStalePid();
    if (options.port) {
      killKnownDashboardProcesses(options.port);
      await waitForPortClosed(options.port, 5000);
    }
    if (!options.quiet) {
      console.log("Dashboard service is not running.");
    }
    return;
  }
  process.kill(pid, "SIGTERM");
  rmStalePid();
  await waitForPidExit(pid, 3000);
  if (options.port) {
    killKnownDashboardProcesses(options.port);
    await waitForPortClosed(options.port, 5000);
  }
  if (!options.quiet) {
    console.log(`Dashboard service stopped. supervisorPid=${pid}`);
  }
}

function killKnownDashboardProcesses(port) {
  const matches = dashboardProcesses(port);
  for (const pid of matches) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
}

function dashboardProcesses(port) {
  const dashboardRun = `${dashboardScript} --port ${port}`;
  const supervisorRun = `${scriptPath} run --port ${port}`;
  return dashboardProcessMatches((command) => command.includes(dashboardRun) || command.includes(supervisorRun));
}

function dashboardSupervisors(port) {
  const supervisorRun = `${scriptPath} run --port ${port}`;
  return dashboardProcessMatches((command) => command.includes(supervisorRun));
}

function dashboardProcessMatches(predicate) {
  const output = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) {
        return null;
      }
      const pid = Number.parseInt(match[1], 10);
      const command = match[2];
      return pid !== process.pid && predicate(command) ? pid : null;
    })
    .filter((pid) => Number.isSafeInteger(pid));
}

async function waitForPidExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (pidAlive(pid) && Date.now() < deadline) {
    await sleep(100);
  }
}

async function waitForPortClosed(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (await canConnect(port)) {
    if (Date.now() >= deadline) {
      return;
    }
    await sleep(150);
  }
}

async function printStatus(port) {
  const pid = readPid();
  const supervisorRunning = Boolean(pid && pidAlive(pid));
  const portOpen = await canConnect(port);
  console.log(`supervisor: ${supervisorRunning ? `running pid=${pid}` : "stopped"}`);
  console.log(`port ${port}: ${portOpen ? "listening" : "closed"}`);
  console.log(`url: http://127.0.0.1:${port}`);
  console.log(`log: ${logFile}`);
}

function readArg(args, key) {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : null;
}

function readPid() {
  if (!existsSync(pidFile)) {
    return null;
  }
  const value = Number.parseInt(readFileSync(pidFile, "utf8"), 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function rmStalePid() {
  if (existsSync(pidFile)) {
    rmSync(pidFile, { force: true });
  }
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeLog(fd, message) {
  writeFileSync(fd, `[${new Date().toISOString()}] ${message}\n`);
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port, timeout: 800 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardLaunchAgentPlist, dashboardLaunchAgentPath } from "../src/launch-agent.ts";

test("builds a keep-alive launch agent that runs the dashboard supervisor", () => {
  const plist = buildDashboardLaunchAgentPlist({
    rootDir: "/Users/example/xen-harvest",
    nodePath: "/opt/node/bin/node",
    port: 4173,
  });

  assert.match(plist, /<key>Label<\/key>\s*<string>ai\.openclaw\.xen-dashboard<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /<string>\/opt\/node\/bin\/node<\/string>/);
  assert.match(plist, /<string>\/Users\/example\/xen-harvest\/bin\/xen-dashboard-service\.mjs<\/string>/);
  assert.match(plist, /<string>run<\/string>/);
  assert.match(plist, /<string>--port<\/string>\s*<string>4173<\/string>/);
  assert.doesNotMatch(plist, /<string>start<\/string>/);
});

test("places the dashboard launch agent in the user LaunchAgents directory", () => {
  assert.equal(
    dashboardLaunchAgentPath("/Users/example"),
    "/Users/example/Library/LaunchAgents/ai.openclaw.xen-dashboard.plist",
  );
});

export const DASHBOARD_LAUNCH_AGENT_LABEL = "ai.openclaw.xen-dashboard";

export type DashboardLaunchAgentOptions = {
  rootDir: string;
  nodePath: string;
  port: number;
};

export function dashboardLaunchAgentPath(homeDir: string): string {
  return `${homeDir}/Library/LaunchAgents/${DASHBOARD_LAUNCH_AGENT_LABEL}.plist`;
}

export function buildDashboardLaunchAgentPlist(options: DashboardLaunchAgentOptions): string {
  const rootDir = stripTrailingSlash(options.rootDir);
  const port = String(options.port);
  const serviceScript = `${rootDir}/bin/xen-dashboard-service.mjs`;
  const dataDir = `${rootDir}/data`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(DASHBOARD_LAUNCH_AGENT_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(options.nodePath)}</string>
    <string>${xmlEscape(serviceScript)}</string>
    <string>run</string>
    <string>--port</string>
    <string>${xmlEscape(port)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(rootDir)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${xmlEscape(port)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(`${dataDir}/xen-dashboard-launchd.out.log`)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(`${dataDir}/xen-dashboard-launchd.err.log`)}</string>
</dict>
</plist>
`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

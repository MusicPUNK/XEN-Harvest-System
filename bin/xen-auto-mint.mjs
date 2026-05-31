#!/usr/bin/env node
import { assertSupportedNodeVersion } from "../scripts/check-node-version.mjs";

assertSupportedNodeVersion();
await import("../src/cli.ts");

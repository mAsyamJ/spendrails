#!/usr/bin/env node
// =============================================================================
// spendrail-dashboard CLI — run the dashboard HTTP server
//
// Usage:
//   npx spendrail-dashboard
//
// Environment variables (all optional):
//   SPENDRAIL_DASHBOARD_PORT  — HTTP port (default: 3100)
//   SPENDRAIL_DASHBOARD_HOST  — Bind address (default: 0.0.0.0)
//   SPENDRAIL_DASHBOARD_TOKEN — Bearer token for auth (optional, if set all requests require it)
// =============================================================================

import { createDashboardServer } from './index.js';
import { PolicyEngine } from '@spendrail/control';
import { SpendTracker, SpendAnalytics } from '@spendrail/observe';
import { TransactionProvenance, DisputeManager } from '@spendrail/protect';
import { EventBus } from '@spendrail/core';

const port = parseInt(process.env.SPENDRAIL_DASHBOARD_PORT ?? '3100') || 3100;
const host = process.env.SPENDRAIL_DASHBOARD_HOST ?? '0.0.0.0';
const bearerToken = process.env.SPENDRAIL_DASHBOARD_TOKEN;

const tracker = new SpendTracker();

const server = createDashboardServer(
  {
    policyEngine: new PolicyEngine(),
    tracker,
    analytics: new SpendAnalytics(tracker),
    provenance: new TransactionProvenance(),
    disputes: new DisputeManager(),
    events: new EventBus(),
  },
  { port, host, bearerToken },
);

process.stderr.write(`\n  SpendRail Dashboard v1.0.0\n`);
process.stderr.write(`  Listening on http://${host}:${port}\n`);
process.stderr.write(`  Auth: ${bearerToken ? 'Bearer token required' : 'none (set SPENDRAIL_DASHBOARD_TOKEN to enable)'}\n`);
process.stderr.write(`  Endpoints: /status /transactions /policies /alerts /disputes /agents /events\n`);
process.stderr.write(`  Ready.\n\n`);

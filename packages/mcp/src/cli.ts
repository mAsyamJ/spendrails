#!/usr/bin/env node
// =============================================================================
// spendrail-mcp CLI — run the MCP server via stdio
//
// Usage:
//   npx spendrail-mcp
//   npx @spendrail/mcp
//
// Environment variables (all optional):
//   SPENDRAIL_MAX_PER_TX      — Max per transaction (default: 100)
//   SPENDRAIL_MAX_DAILY       — Max daily spend (default: 500)
//   SPENDRAIL_MAX_HOURLY      — Max hourly spend (default: 200)
//   SPENDRAIL_APPROVAL_ABOVE  — Approval threshold (default: 50)
//   SPENDRAIL_INITIAL_BALANCE — Starting balance (default: 10000)
//   SPENDRAIL_CURRENCY        — Currency code (default: USD)
// =============================================================================

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AgentId, PolicyId } from '@spendrail/core';
import { createSpendRailMcpServer } from './server.js';
import { DEFAULT_CONFIG } from './stack.js';

const env = process.env;
const currency = env.SPENDRAIL_CURRENCY ?? DEFAULT_CONFIG.policy.currency;

const { server, stack } = createSpendRailMcpServer({
  policy: {
    id: DEFAULT_CONFIG.policy.id,
    maxPerTransaction: parseFloat(env.SPENDRAIL_MAX_PER_TX ?? '') || DEFAULT_CONFIG.policy.maxPerTransaction,
    maxDaily: parseFloat(env.SPENDRAIL_MAX_DAILY ?? '') || DEFAULT_CONFIG.policy.maxDaily,
    maxHourly: parseFloat(env.SPENDRAIL_MAX_HOURLY ?? '') || DEFAULT_CONFIG.policy.maxHourly,
    approvalThreshold: parseFloat(env.SPENDRAIL_APPROVAL_ABOVE ?? '') || DEFAULT_CONFIG.policy.approvalThreshold,
    currency,
  },
  alerts: { ...DEFAULT_CONFIG.alerts, currency },
  sandbox: {
    ...DEFAULT_CONFIG.sandbox,
    initialBalance: parseFloat(env.SPENDRAIL_INITIAL_BALANCE ?? '') || DEFAULT_CONFIG.sandbox.initialBalance,
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write(`\n  SpendRail MCP Server v${stack.config.serverVersion}\n`);
process.stderr.write(`  Tools: pay, check_balance, payment_history, discover_capabilities,\n`);
process.stderr.write(`         manage_policy, evaluate_payment, file_dispute, list_disputes,\n`);
process.stderr.write(`         get_audit_trail, get_alerts\n`);
process.stderr.write(`  Max/tx: $${stack.config.policy.maxPerTransaction} | Daily: $${stack.config.policy.maxDaily} | Balance: $${stack.config.sandbox.initialBalance}\n`);
process.stderr.write(`  Ready.\n\n`);

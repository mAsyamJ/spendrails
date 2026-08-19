#!/usr/bin/env node
// =============================================================================
// SpendRail MCP Payment Server
//
// An MCP server that demonstrates how SpendRail protects AI agent payments.
// Exposes three tools:
//   - pay: Initiate a payment (with policy enforcement)
//   - check_balance: Query wallet balance and budget utilization
//   - payment_history: View transaction audit trail
//
// Transport: stdio (standard for Claude Desktop, VS Code, etc.)
//
// Usage:
//   npx tsx src/index.ts
//   node --loader tsx src/index.ts
//
// Environment variables (all optional):
//   SPENDRAIL_MAX_PER_TX      — Max amount per transaction (default: 100)
//   SPENDRAIL_MAX_DAILY       — Max daily spend (default: 500)
//   SPENDRAIL_MAX_HOURLY      — Max hourly spend (default: 200)
//   SPENDRAIL_APPROVAL_ABOVE  — Approval threshold (default: 50)
//   SPENDRAIL_INITIAL_BALANCE — Starting wallet balance (default: 10000)
//   SPENDRAIL_CURRENCY        — Currency code (default: USD)
// =============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { AgentId, PolicyId } from '@spendrail/core';

import { SpendRailStack, DEFAULT_CONFIG } from './spendrail.js';
import type { ServerConfig } from './types.js';

import { registerPayTool } from './tools/pay.js';
import { registerBalanceTool } from './tools/balance.js';
import { registerHistoryTool } from './tools/history.js';

// =============================================================================
// Configuration from environment
// =============================================================================

function loadConfig(): ServerConfig {
  const env = process.env;

  const currency = env.SPENDRAIL_CURRENCY ?? DEFAULT_CONFIG.policy.currency;

  return {
    ...DEFAULT_CONFIG,
    policy: {
      id: DEFAULT_CONFIG.policy.id,
      maxPerTransaction: parseFloat(env.SPENDRAIL_MAX_PER_TX ?? '') || DEFAULT_CONFIG.policy.maxPerTransaction,
      maxDaily: parseFloat(env.SPENDRAIL_MAX_DAILY ?? '') || DEFAULT_CONFIG.policy.maxDaily,
      maxHourly: parseFloat(env.SPENDRAIL_MAX_HOURLY ?? '') || DEFAULT_CONFIG.policy.maxHourly,
      approvalThreshold: parseFloat(env.SPENDRAIL_APPROVAL_ABOVE ?? '') || DEFAULT_CONFIG.policy.approvalThreshold,
      currency,
    },
    alerts: {
      ...DEFAULT_CONFIG.alerts,
      currency,
    },
    sandbox: {
      ...DEFAULT_CONFIG.sandbox,
      initialBalance: parseFloat(env.SPENDRAIL_INITIAL_BALANCE ?? '') || DEFAULT_CONFIG.sandbox.initialBalance,
    },
  };
}

// =============================================================================
// Server initialization
// =============================================================================

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize SpendRail stack
  const stack = new SpendRailStack(config);

  // Create MCP server
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  // Register tools
  registerPayTool(server, stack);
  registerBalanceTool(server, stack);
  registerHistoryTool(server, stack);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup info to stderr (stdout is reserved for MCP protocol)
  process.stderr.write(`\n`);
  process.stderr.write(`  SpendRail MCP Payment Server v${config.serverVersion}\n`);
  process.stderr.write(`  ─────────────────────────────────────────────\n`);
  process.stderr.write(`  Transport:  stdio\n`);
  process.stderr.write(`  Currency:   ${config.policy.currency}\n`);
  process.stderr.write(`  Balance:    $${config.sandbox.initialBalance}\n`);
  process.stderr.write(`  Max/tx:     $${config.policy.maxPerTransaction}\n`);
  process.stderr.write(`  Approval:   >$${config.policy.approvalThreshold}\n`);
  process.stderr.write(`  Daily cap:  $${config.policy.maxDaily}\n`);
  process.stderr.write(`  Hourly cap: $${config.policy.maxHourly}\n`);
  process.stderr.write(`  ─────────────────────────────────────────────\n`);
  process.stderr.write(`  Tools: pay, check_balance, payment_history\n`);
  process.stderr.write(`  Ready for connections.\n`);
  process.stderr.write(`\n`);
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});

// =============================================================================
// @spendrail/mcp — MCP Server factory
// Creates a fully configured MCP server with all SpendRail tools
// =============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SpendRailStack, DEFAULT_CONFIG } from './stack.js';
import type { McpServerConfig } from './types.js';

import { registerPayTool } from './tools/pay.js';
import { registerBalanceTool } from './tools/balance.js';
import { registerHistoryTool } from './tools/history.js';
import { registerDiscoverTool } from './tools/discover.js';
import { registerPolicyTool } from './tools/policy.js';
import { registerDisputeTool } from './tools/dispute.js';
import { registerProvenanceTool } from './tools/provenance.js';
import { registerAlertsTool } from './tools/alerts.js';

export interface CreateServerResult {
  server: McpServer;
  stack: SpendRailStack;
}

/**
 * Create a fully configured SpendRail MCP server.
 *
 * @example
 * ```ts
 * import { createSpendRailMcpServer } from '@spendrail/mcp';
 * import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
 *
 * const { server } = createSpendRailMcpServer();
 * await server.connect(new StdioServerTransport());
 * ```
 */
export function createSpendRailMcpServer(config?: Partial<McpServerConfig>): CreateServerResult {
  const fullConfig: McpServerConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    policy: { ...DEFAULT_CONFIG.policy, ...config?.policy },
    alerts: { ...DEFAULT_CONFIG.alerts, ...config?.alerts },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...config?.sandbox },
  };

  const stack = new SpendRailStack(fullConfig);

  const server = new McpServer({
    name: fullConfig.serverName,
    version: fullConfig.serverVersion,
  });

  // Register all tools
  registerPayTool(server, stack);
  registerBalanceTool(server, stack);
  registerHistoryTool(server, stack);
  registerDiscoverTool(server, stack);
  registerPolicyTool(server, stack);
  registerDisputeTool(server, stack);
  registerProvenanceTool(server, stack);
  registerAlertsTool(server, stack);

  return { server, stack };
}

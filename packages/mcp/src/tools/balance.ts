import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SpendRailStack } from '../stack.js';

export function registerBalanceTool(server: McpServer, stack: SpendRailStack): void {
  server.tool(
    'check_balance',
    'Get wallet balance, total spent, and budget utilization (daily/hourly). Returns structured JSON.',
    {},
    async () => {
      const info = stack.getBalanceInfo();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      };
    }
  );
}

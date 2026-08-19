// =============================================================================
// Tool: check_balance — Query wallet balance and budget utilization
// Demonstrates: SpendTracker analytics, PolicyEngine budget tracking
// =============================================================================

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SpendRailStack } from '../spendrail.js';

/**
 * Register the "check_balance" tool with the MCP server.
 *
 * Returns the current wallet balance, total spend, and budget utilization
 * across daily and hourly windows. Gives the agent full visibility into
 * how much it can still spend.
 */
export function registerBalanceTool(server: McpServer, stack: SpendRailStack): void {
  server.tool(
    'check_balance',
    'Check current wallet balance, total spend, and remaining budget for daily and hourly spending limits.',
    {
      currency: z.string().optional().describe(
        'Currency to check (default: server configured currency)'
      ),
    },
    async ({ currency }) => {
      try {
        const info = stack.getBalanceInfo(currency);

        const lines: string[] = [
          `Wallet Balance: $${info.balance.toFixed(2)} ${info.currency}`,
          '',
          'Spending Summary:',
          `  Total spent: $${info.totalSpent.toFixed(2)}`,
          `  Transactions: ${info.transactionCount}`,
          '',
          'Budget Utilization:',
          `  Hourly: $${info.hourlyBudget.used.toFixed(2)} / $${info.hourlyBudget.limit.toFixed(2)} (remaining: $${info.hourlyBudget.remaining.toFixed(2)})`,
          `  Daily:  $${info.dailyBudget.used.toFixed(2)} / $${info.dailyBudget.limit.toFixed(2)} (remaining: $${info.dailyBudget.remaining.toFixed(2)})`,
          '',
          'Policy Limits:',
          `  Max per transaction: $${stack.config.policy.maxPerTransaction}`,
          `  Approval required above: $${stack.config.policy.approvalThreshold}`,
        ];

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Balance check error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

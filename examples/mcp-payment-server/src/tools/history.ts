// =============================================================================
// Tool: payment_history — Query past payment records
// Demonstrates: SpendTracker query API, transaction audit trail
// =============================================================================

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SpendRailStack } from '../spendrail.js';

/**
 * Register the "payment_history" tool with the MCP server.
 *
 * Returns a list of recent transactions with their status, amounts,
 * and recipients. Provides full audit trail visibility to the agent.
 */
export function registerHistoryTool(server: McpServer, stack: SpendRailStack): void {
  server.tool(
    'payment_history',
    'Retrieve recent payment transaction history. Shows status (completed, blocked, pending), amounts, recipients, and timestamps.',
    {
      limit: z.number().int().min(1).max(100).default(10).describe(
        'Maximum number of transactions to return (default: 10, max: 100)'
      ),
      agent_id: z.string().optional().describe(
        'Filter by agent ID (optional — defaults to all agents)'
      ),
    },
    async ({ limit, agent_id }) => {
      try {
        const history = stack.getPaymentHistory(limit, agent_id);

        if (history.transactions.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No payment history found. No transactions have been recorded yet.',
            }],
          };
        }

        const lines: string[] = [
          `Payment History (${history.transactions.length} of ${history.totalCount} total):`,
          '',
        ];

        for (const tx of history.transactions) {
          const statusIcon =
            tx.status === 'completed' ? '[OK]' :
            tx.status === 'rejected' ? '[BLOCKED]' :
            tx.status === 'pending' ? '[PENDING]' :
            tx.status === 'failed' ? '[FAILED]' :
            `[${tx.status.toUpperCase()}]`;

          lines.push(`${statusIcon} $${tx.amount.toFixed(2)} ${tx.currency} -> ${tx.recipient}`);
          lines.push(`    Purpose: ${tx.purpose}`);
          lines.push(`    Time: ${tx.createdAt}`);
          lines.push(`    TX ID: ${tx.id}`);
          if (tx.protocolTxId) {
            lines.push(`    Protocol TX: ${tx.protocolTxId}`);
          }
          lines.push('');
        }

        // Append alert log summary if any alerts have fired
        const alertLog = stack.getAlertLog();
        if (alertLog.length > 0) {
          lines.push('---');
          lines.push(`Session Alerts (${alertLog.length} total):`);
          for (const alert of alertLog.slice(-5)) {
            lines.push(`  [${alert.severity.toUpperCase()}] ${alert.message}`);
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `History query error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

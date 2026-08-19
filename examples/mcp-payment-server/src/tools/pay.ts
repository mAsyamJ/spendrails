// =============================================================================
// Tool: pay — Initiate a payment through the SpendRail control plane
// Demonstrates: PolicyEngine evaluation, SpendTracker recording, alert checks
// =============================================================================

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SpendRailStack } from '../spendrail.js';

/**
 * Register the "pay" tool with the MCP server.
 *
 * This tool lets an AI agent initiate a payment. Every payment goes through
 * the SpendRail pipeline:
 *   1. PolicyEngine evaluates spending rules (amount limits, budgets)
 *   2. If allowed, MockX402 executes the payment
 *   3. SpendTracker records the transaction
 *   4. SpendAlerts checks for anomalies
 *
 * The agent sees clear feedback: success, blocked (with reason), or
 * requires_approval (with instructions).
 */
export function registerPayTool(server: McpServer, stack: SpendRailStack): void {
  server.tool(
    'pay',
    'Initiate a payment to a recipient. The payment is evaluated against spending policies (amount limits, daily/hourly budgets) before execution. Returns success, blocked, or requires_approval status.',
    {
      recipient: z.string().describe(
        'The payment recipient — a URL, service name, or wallet address (e.g., "https://api.openai.com/v1/chat", "vendor:acme-corp")'
      ),
      amount: z.number().positive().describe(
        'Payment amount as a positive number (e.g., 25.00)'
      ),
      currency: z.string().default('USD').describe(
        'Currency code (default: "USD")'
      ),
      reason: z.string().describe(
        'Human-readable reason for the payment (e.g., "GPT-4 API tokens for market research")'
      ),
    },
    async ({ recipient, amount, currency, reason }) => {
      try {
        const result = await stack.processPayment(recipient, amount, currency, reason);

        // Format the response for the AI agent
        const lines: string[] = [];

        if (result.success) {
          lines.push(`Payment completed successfully.`);
          lines.push(`  Amount: $${amount.toFixed(2)} ${currency}`);
          lines.push(`  Recipient: ${recipient}`);
          lines.push(`  Reason: ${reason}`);
          lines.push(`  Transaction ID: ${result.transactionId}`);
          lines.push(`  Remaining balance: $${stack.wallet.balance.toFixed(2)}`);
        } else if (result.status === 'blocked') {
          lines.push(`Payment BLOCKED.`);
          lines.push(`  Amount: $${amount.toFixed(2)} ${currency}`);
          lines.push(`  Recipient: ${recipient}`);
          lines.push(`  Reason: ${result.message}`);
          if (result.policyDetails) {
            lines.push(`  Policy action: ${result.policyDetails.action}`);
            if (result.policyDetails.triggeredRule) {
              lines.push(`  Triggered rule: ${result.policyDetails.triggeredRule}`);
            }
          }
        } else if (result.status === 'requires_approval') {
          lines.push(`Payment requires HUMAN APPROVAL.`);
          lines.push(`  Amount: $${amount.toFixed(2)} ${currency}`);
          lines.push(`  Recipient: ${recipient}`);
          lines.push(`  Reason: ${reason}`);
          lines.push(`  ${result.message}`);
          lines.push(`  The payment has been queued. A human operator must approve it.`);
        }

        // Append any alerts
        if (result.alerts && result.alerts.length > 0) {
          lines.push('');
          lines.push('Alerts triggered:');
          for (const alert of result.alerts) {
            lines.push(`  ${alert}`);
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          isError: !result.success,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Payment error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

// =============================================================================
// SpendRail Integration — Configures the full SpendRail stack for MCP usage
// Sets up PolicyEngine, SpendTracker, SpendAlerts, and MockX402
// =============================================================================

import type {
  AgentId,
  AgentTransaction,
  PolicyId,
  SpendAlert,
} from '@spendrail/core';
import { createTransaction } from '@spendrail/core';
import {
  PolicyEngine,
  blockAbove,
  requireApprovalAbove,
  allowAll,
} from '@spendrail/control';
import { SpendTracker, SpendAlerts } from '@spendrail/observe';
import { MockX402 } from '@spendrail/sandbox';

import type { ServerConfig, WalletState, PaymentResult } from './types.js';

/**
 * SpendRailStack bundles all SpendRail components into a single interface
 * that the MCP tools interact with. This is the core integration layer.
 */
export class SpendRailStack {
  readonly policyEngine: PolicyEngine;
  readonly tracker: SpendTracker;
  readonly alerts: SpendAlerts;
  readonly mockPayment: MockX402;
  readonly wallet: WalletState;
  readonly config: ServerConfig;

  /** Accumulated alerts for the current session */
  private readonly alertLog: SpendAlert[] = [];

  constructor(config: ServerConfig) {
    this.config = config;

    // --- Observe: Transaction tracking ---
    this.tracker = new SpendTracker();

    // --- Observe: Alert rules ---
    this.alerts = new SpendAlerts(this.tracker);
    this.setupAlerts(config);

    // --- Control: Policy engine ---
    this.policyEngine = new PolicyEngine();
    this.setupPolicy(config);

    // --- Sandbox: Mock payment backend ---
    this.mockPayment = new MockX402({
      latencyMs: config.sandbox.latencyMs,
      failureRate: config.sandbox.failureRate,
      supportedCurrencies: [config.policy.currency],
    });

    // --- Wallet state ---
    this.wallet = {
      balance: config.sandbox.initialBalance,
      currency: config.policy.currency,
      totalSpent: 0,
      transactionCount: 0,
    };
  }

  /**
   * Process a payment request through the full SpendRail pipeline:
   * 1. Create transaction
   * 2. Evaluate against PolicyEngine
   * 3. If allowed, execute via mock backend
   * 4. Record in SpendTracker
   * 5. Evaluate alerts
   */
  async processPayment(
    recipient: string,
    amount: number,
    currency: string,
    reason: string
  ): Promise<PaymentResult> {
    // Build the transaction
    const tx = createTransaction({
      agentId: this.config.defaultAgentId,
      recipient,
      amount,
      currency,
      purpose: reason,
      protocol: 'x402',
    });

    // Step 1: Policy evaluation
    const evaluation = this.policyEngine.evaluate(tx);

    if (evaluation.action === 'deny') {
      // Record the blocked transaction
      tx.status = 'rejected';
      this.tracker.record(tx);

      return {
        success: false,
        transactionId: tx.id,
        status: 'blocked',
        message: `Payment blocked: ${evaluation.reason}`,
        policyDetails: {
          action: evaluation.action,
          reason: evaluation.reason,
          triggeredRule: evaluation.triggeredRule?.name,
        },
      };
    }

    if (evaluation.action === 'require_approval') {
      // Record as pending approval
      tx.status = 'pending';
      this.tracker.record(tx);

      return {
        success: false,
        transactionId: tx.id,
        status: 'requires_approval',
        message: `Payment requires human approval: ${evaluation.reason}. Transaction ID: ${tx.id}`,
        policyDetails: {
          action: evaluation.action,
          reason: evaluation.reason,
          triggeredRule: evaluation.triggeredRule?.name,
        },
      };
    }

    // Step 2: Check wallet balance
    if (amount > this.wallet.balance) {
      tx.status = 'failed';
      this.tracker.record(tx);

      return {
        success: false,
        transactionId: tx.id,
        status: 'blocked',
        message: `Insufficient balance: $${this.wallet.balance.toFixed(2)} available, $${amount.toFixed(2)} required`,
      };
    }

    // Step 3: Execute payment via mock backend
    const paymentResult = await this.mockPayment.processPayment(tx);

    if (!paymentResult.success) {
      tx.status = 'failed';
      this.tracker.record(tx);

      return {
        success: false,
        transactionId: tx.id,
        status: 'blocked',
        message: `Payment execution failed: ${paymentResult.error}`,
      };
    }

    // Step 4: Mark as completed, update wallet, record in tracker
    tx.status = 'completed';
    tx.protocolTxId = paymentResult.txId;
    tx.updatedAt = new Date().toISOString();

    this.wallet.balance -= amount;
    this.wallet.totalSpent += amount;
    this.wallet.transactionCount++;

    this.tracker.record(tx);
    this.policyEngine.recordTransaction(tx);

    // Step 5: Evaluate alerts
    const triggeredAlerts = await this.alerts.evaluate(tx);
    const alertMessages = triggeredAlerts.map((a) => `[${a.severity}] ${a.message}`);
    this.alertLog.push(...triggeredAlerts);

    return {
      success: true,
      transactionId: tx.id,
      status: 'completed',
      message: `Payment of $${amount.toFixed(2)} ${currency} to ${recipient} completed successfully. TX: ${paymentResult.txId}`,
      policyDetails: {
        action: evaluation.action,
        reason: evaluation.reason,
      },
      alerts: alertMessages.length > 0 ? alertMessages : undefined,
    };
  }

  /**
   * Get the current wallet balance and budget utilization.
   */
  getBalanceInfo(currency?: string): {
    balance: number;
    currency: string;
    totalSpent: number;
    transactionCount: number;
    dailyBudget: { used: number; limit: number; remaining: number };
    hourlyBudget: { used: number; limit: number; remaining: number };
  } {
    const cur = currency ?? this.config.policy.currency;
    const policy = this.policyEngine.getPolicies()[0];

    // Get daily budget usage
    const dailyBudget = policy?.budgets.find((b) => b.window === 'daily');
    const dailySpend = dailyBudget
      ? this.policyEngine.getCurrentSpend(policy!.id, dailyBudget)
      : { amount: 0 };

    // Get hourly budget usage
    const hourlyBudget = policy?.budgets.find((b) => b.window === 'hourly');
    const hourlySpend = hourlyBudget
      ? this.policyEngine.getCurrentSpend(policy!.id, hourlyBudget)
      : { amount: 0 };

    return {
      balance: this.wallet.balance,
      currency: cur,
      totalSpent: this.wallet.totalSpent,
      transactionCount: this.wallet.transactionCount,
      dailyBudget: {
        used: dailySpend.amount,
        limit: this.config.policy.maxDaily,
        remaining: Math.max(0, this.config.policy.maxDaily - dailySpend.amount),
      },
      hourlyBudget: {
        used: hourlySpend.amount,
        limit: this.config.policy.maxHourly,
        remaining: Math.max(0, this.config.policy.maxHourly - hourlySpend.amount),
      },
    };
  }

  /**
   * Get payment history from the SpendTracker.
   */
  getPaymentHistory(
    limit?: number,
    agentId?: string
  ): {
    transactions: Array<{
      id: string;
      recipient: string;
      amount: number;
      currency: string;
      purpose: string;
      status: string;
      createdAt: string;
      protocolTxId?: string;
    }>;
    totalCount: number;
  } {
    const filter: { agentId?: AgentId; limit?: number } = {};
    if (agentId) filter.agentId = agentId as AgentId;
    if (limit) filter.limit = limit;

    const txs = this.tracker.query(filter);

    return {
      transactions: txs.map((tx) => ({
        id: tx.id,
        recipient: tx.recipient,
        amount: tx.amount,
        currency: tx.currency,
        purpose: tx.purpose,
        status: tx.status,
        createdAt: tx.createdAt,
        protocolTxId: tx.protocolTxId,
      })),
      totalCount: this.tracker.size,
    };
  }

  /**
   * Get all alerts that have been triggered during this session.
   */
  getAlertLog(): SpendAlert[] {
    return [...this.alertLog];
  }

  // ---------------------------------------------------------------------------
  // Private setup methods
  // ---------------------------------------------------------------------------

  private setupPolicy(config: ServerConfig): void {
    this.policyEngine.loadPolicy({
      id: config.policy.id,
      name: 'MCP Agent Payment Policy',
      description: 'Default spending controls for AI agents using this MCP server',
      enabled: true,
      rules: [
        blockAbove(config.policy.maxPerTransaction, config.policy.currency),
        requireApprovalAbove(config.policy.approvalThreshold, config.policy.currency),
        allowAll(),
      ],
      budgets: [
        {
          window: 'daily',
          maxAmount: config.policy.maxDaily,
          currency: config.policy.currency,
        },
        {
          window: 'hourly',
          maxAmount: config.policy.maxHourly,
          currency: config.policy.currency,
        },
      ],
    });
  }

  private setupAlerts(config: ServerConfig): void {
    // Large transaction alert
    this.alerts.addRule({
      id: 'large-tx',
      name: 'Large Transaction Alert',
      type: 'large_transaction',
      severity: 'warning',
      enabled: true,
      config: {
        type: 'large_transaction',
        threshold: config.alerts.largeTransactionThreshold,
        currency: config.alerts.currency,
      },
    });

    // Rate spike alert
    this.alerts.addRule({
      id: 'rate-spike',
      name: 'Transaction Rate Spike',
      type: 'rate_spike',
      severity: 'critical',
      enabled: true,
      config: {
        type: 'rate_spike',
        maxTransactions: config.alerts.rateSpikeMaxPerMinute,
        windowMs: 60_000, // 1 minute
      },
    });

    // New recipient alert
    this.alerts.addRule({
      id: 'new-recipient',
      name: 'New Recipient Detected',
      type: 'new_recipient',
      severity: 'info',
      enabled: true,
      config: {
        type: 'new_recipient',
      },
    });

    // Log alerts to stderr (visible to operators, not to the agent)
    this.alerts.onAlert((alert) => {
      process.stderr.write(
        `[SpendRail Alert] ${alert.severity.toUpperCase()}: ${alert.message}\n`
      );
    });
  }
}

// =============================================================================
// Default configuration
// =============================================================================

export const DEFAULT_CONFIG: ServerConfig = {
  serverName: 'spendrail-mcp-payment-server',
  serverVersion: '0.1.0',
  defaultAgentId: 'mcp-agent' as AgentId,
  policy: {
    id: 'mcp-default' as PolicyId,
    maxPerTransaction: 100,
    maxDaily: 500,
    maxHourly: 200,
    approvalThreshold: 50,
    currency: 'USD',
  },
  alerts: {
    largeTransactionThreshold: 50,
    rateSpikeMaxPerMinute: 5,
    currency: 'USD',
  },
  sandbox: {
    latencyMs: 50,
    failureRate: 0,
    initialBalance: 10000,
  },
};

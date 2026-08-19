// =============================================================================
// Types — Shared type definitions for the MCP Payment Server
// =============================================================================

import type { AgentId, PolicyId } from '@spendrail/core';

/**
 * Configuration for the MCP Payment Server.
 * Controls spending limits, alert thresholds, and mock payment behavior.
 */
export interface ServerConfig {
  /** Server name shown in MCP handshake */
  readonly serverName: string;

  /** Server version */
  readonly serverVersion: string;

  /** Default agent ID for transactions (simulates a single agent) */
  readonly defaultAgentId: AgentId;

  /** Policy configuration */
  readonly policy: PolicyConfig;

  /** Alert configuration */
  readonly alerts: AlertConfig;

  /** Mock payment backend configuration */
  readonly sandbox: SandboxConfig;
}

/** Policy limits for the SpendRail control plane */
export interface PolicyConfig {
  /** Policy ID */
  readonly id: PolicyId;

  /** Maximum amount per single transaction (default: $100) */
  readonly maxPerTransaction: number;

  /** Maximum daily spend (default: $500) */
  readonly maxDaily: number;

  /** Maximum hourly spend (default: $200) */
  readonly maxHourly: number;

  /** Amount above which human approval is required (default: $50) */
  readonly approvalThreshold: number;

  /** Currency for all limits (default: 'USD') */
  readonly currency: string;
}

/** Alert rule configuration */
export interface AlertConfig {
  /** Threshold for large transaction alerts (default: $50) */
  readonly largeTransactionThreshold: number;

  /** Max transactions per minute before rate spike alert (default: 5) */
  readonly rateSpikeMaxPerMinute: number;

  /** Currency for alert rules */
  readonly currency: string;
}

/** Mock payment backend configuration */
export interface SandboxConfig {
  /** Simulated network latency in ms (default: 50) */
  readonly latencyMs: number;

  /** Simulated failure rate 0.0–1.0 (default: 0) */
  readonly failureRate: number;

  /** Initial mock balance (default: 10000) */
  readonly initialBalance: number;
}

/**
 * In-memory wallet state for the mock payment backend.
 */
export interface WalletState {
  /** Current balance */
  balance: number;

  /** Currency */
  readonly currency: string;

  /** Total amount spent */
  totalSpent: number;

  /** Total number of transactions */
  transactionCount: number;
}

/**
 * Payment request input from the MCP tool call.
 */
export interface PaymentRequest {
  /** Recipient address, URL, or identifier */
  readonly recipient: string;

  /** Amount to pay */
  readonly amount: number;

  /** Currency (default: USD) */
  readonly currency: string;

  /** Human-readable reason for the payment */
  readonly reason: string;
}

/**
 * Result returned to the AI agent after a payment attempt.
 */
export interface PaymentResult {
  /** Whether the payment was executed */
  readonly success: boolean;

  /** Transaction ID (if executed) */
  readonly transactionId?: string;

  /** Status: allowed, blocked, or requires_approval */
  readonly status: 'completed' | 'blocked' | 'requires_approval';

  /** Human-readable message */
  readonly message: string;

  /** Policy evaluation details */
  readonly policyDetails?: {
    readonly action: string;
    readonly reason: string;
    readonly triggeredRule?: string;
  };

  /** Alerts triggered by this transaction */
  readonly alerts?: string[];
}

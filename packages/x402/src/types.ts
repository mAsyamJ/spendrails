// =============================================================================
// @spendrail/x402 — Type Definitions
// SpendRail-specific types for x402 protocol integration.
// x402 protocol types come from @x402/core (peer dependency).
// =============================================================================

import type {
  AgentId,
  AgentTransaction,
  Logger,
  PolicyEvaluation,
} from '@spendrail/core';

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

/** Circuit breaker state machine states */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/** Configuration for a single circuit breaker instance */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  readonly failureThreshold: number;

  /** Time in ms to wait before transitioning from open to half-open (default: 30000) */
  readonly recoveryTimeoutMs: number;

  /** Max requests allowed in half-open state before deciding (default: 1) */
  readonly halfOpenMaxRequests: number;
}

// ---------------------------------------------------------------------------
// x402 SpendRail Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the SpendRail x402 adapter.
 * Passed to `SpendRailX402Adapter` on construction.
 */
export interface X402SpendRailConfig {
  /** Logger instance for structured logging */
  readonly logger?: Logger;

  /**
   * Default agent ID to use when the payer address cannot be resolved.
   * If not set and resolution fails, the adapter will use 'unknown-agent'.
   */
  readonly defaultAgentId?: AgentId;

  /**
   * Default currency for transactions (default: 'USDC').
   * Used when currency cannot be inferred from payment requirements.
   */
  readonly defaultCurrency?: string;

  /**
   * Circuit breaker configuration (per facilitator).
   * Partial — missing fields use defaults.
   */
  readonly circuitBreaker?: Partial<CircuitBreakerConfig>;

  /**
   * Optional agent ID resolver. Maps a payer address (e.g., wallet address)
   * to a SpendRail AgentId. If not provided, the payer address is used directly.
   */
  readonly resolveAgentId?: (payerAddress: string) => AgentId | Promise<AgentId>;

  /**
   * If true, a policy denial aborts the x402 verify step entirely
   * (returns verify failure). Default: true.
   */
  readonly abortOnPolicyDeny?: boolean;

  /**
   * If true, internal errors in policy evaluation allow the payment to proceed.
   * If false (default), internal errors abort the payment for safety.
   */
  readonly failOpen?: boolean;

  /**
   * SpendRail session ID to inject into enriched responses.
   * If not set, a random session ID is generated.
   */
  readonly sessionId?: string;
}

// ---------------------------------------------------------------------------
// Transaction Context — the bridge between x402 and SpendRail
// ---------------------------------------------------------------------------

/**
 * Contextual data extracted from an x402 payment flow,
 * mapped to SpendRail's domain model. This is the intermediate
 * representation used between x402 hooks and SpendRail engines.
 */
export interface X402TransactionContext {
  /** The mapped SpendRail transaction */
  readonly transaction: AgentTransaction;

  /** Policy evaluation result (populated after onBeforeVerify) */
  policyResult?: PolicyEvaluation;

  /** x402 verify response data (populated after onAfterVerify) */
  verifyData?: Readonly<Record<string, unknown>>;

  /** x402 settle response data (populated after onAfterSettle) */
  settleData?: Readonly<Record<string, unknown>>;

  /** Timestamps for each lifecycle stage */
  readonly timestamps: {
    created: string;
    verified?: string;
    settled?: string;
  };
}

// ---------------------------------------------------------------------------
// x402 Protocol Types (minimal interfaces for type-safety)
// These mirror @x402/core types so the adapter can compile without
// requiring @x402/core at build time. At runtime, the real types flow through.
// ---------------------------------------------------------------------------

/**
 * Minimal representation of an x402 PaymentPayload.
 * The full type is provided by @x402/core at runtime.
 */
export interface X402PaymentPayload {
  readonly x402Version: number;
  readonly scheme: string;
  readonly network: string;
  readonly payload: string;
  readonly resource: string;
  readonly [key: string]: unknown;
}

/**
 * Minimal representation of x402 PaymentRequirements.
 * The full type is provided by @x402/core at runtime.
 */
export interface X402PaymentRequirements {
  readonly scheme: string;
  readonly network: string;
  readonly maxAmountRequired: string;
  readonly resource: string;
  readonly description?: string;
  readonly payTo: string;
  readonly [key: string]: unknown;
}

/**
 * Minimal x402 VerifyResponse shape.
 */
export interface X402VerifyResponse {
  readonly isValid: boolean;
  readonly invalidReason?: string;
  readonly payer?: string;
  readonly [key: string]: unknown;
}

/**
 * Minimal x402 SettleResponse shape.
 */
export interface X402SettleResponse {
  readonly success: boolean;
  readonly txHash?: string;
  readonly network?: string;
  readonly [key: string]: unknown;
}

/**
 * x402 FacilitatorClient interface — what we wrap.
 */
export interface X402FacilitatorClient {
  verify(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Promise<X402VerifyResponse>;

  settle(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Promise<X402SettleResponse>;

  supported(): Promise<{ schemes: string[]; networks: string[] }>;
}

/**
 * x402 ResourceServerExtension interface — what we create.
 */
export interface X402ResourceServerExtension {
  readonly key: string;
  enrichPaymentRequiredResponse(
    requirements: X402PaymentRequirements,
  ): Record<string, unknown>;
  enrichSettlementResponse(
    settlementResponse: X402SettleResponse,
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Record<string, unknown>;
}

/**
 * x402 server lifecycle hooks shape.
 * The adapter registers these hooks on the x402 server.
 */
export interface X402ServerHooks {
  onBeforeVerify?: (
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ) => Promise<{ abort?: boolean; reason?: string } | void>;

  onAfterVerify?: (
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    verifyResponse: X402VerifyResponse,
  ) => Promise<void>;

  onVerifyFailure?: (
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    error: unknown,
  ) => Promise<void>;

  onBeforeSettle?: (
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ) => Promise<{ abort?: boolean; reason?: string } | void>;

  onAfterSettle?: (
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    settleResponse: X402SettleResponse,
  ) => Promise<void>;

  onSettleFailure?: (
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    error: unknown,
  ) => Promise<void>;
}

/**
 * An x402 server instance that accepts lifecycle hooks.
 */
export interface X402Server {
  use(hooks: X402ServerHooks): void;
}

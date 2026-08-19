// =============================================================================
// @spendrail/x402 — Public API
// x402 protocol adapter for SpendRail: spending limits, circuit breakers,
// and observability for HTTP 402 payments.
// =============================================================================

// Core adapter
export { SpendRailX402Adapter } from './adapter.js';
export type { SpendRailEngines } from './adapter.js';

// Circuit breaker
export { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker.js';

// Transaction mapper utilities
export {
  extractAgent,
  extractAmount,
  extractRecipient,
  mapToTransaction,
  transactionKey,
} from './transaction-mapper.js';

// Types
export type {
  // Configuration
  X402SpendRailConfig,
  CircuitBreakerConfig,
  CircuitBreakerState,

  // Context
  X402TransactionContext,

  // x402 protocol type mirrors (from peer dependency)
  X402PaymentPayload,
  X402PaymentRequirements,
  X402VerifyResponse,
  X402SettleResponse,
  X402FacilitatorClient,
  X402ResourceServerExtension,
  X402ServerHooks,
  X402Server,
} from './types.js';

// =============================================================================
// SpendRailX402Adapter — The core integration layer between x402 and SpendRail
//
// Three integration surfaces:
// 1. withLifecycleHooks(server) — register x402 server lifecycle hooks
// 2. wrapFacilitatorClient(client) — wrap FacilitatorClient with policy checks
// 3. createExtension() — create a ResourceServerExtension for response enrichment
// =============================================================================

import type {
  AgentTransaction,
  Logger,
} from '@spendrail/core';
import type { PolicyEngine } from '@spendrail/control';
import type { SpendTracker, SpendAlerts } from '@spendrail/observe';
import type { TransactionProvenance } from '@spendrail/protect';

import { CircuitBreaker } from './circuit-breaker.js';
import { mapToTransaction, transactionKey } from './transaction-mapper.js';
import type {
  X402SpendRailConfig,
  X402TransactionContext,
  X402PaymentPayload,
  X402PaymentRequirements,
  X402VerifyResponse,
  X402SettleResponse,
  X402FacilitatorClient,
  X402ResourceServerExtension,
  X402Server,
  X402ServerHooks,
} from './types.js';

// ---------------------------------------------------------------------------
// Dependencies — the SpendRail engines this adapter orchestrates
// ---------------------------------------------------------------------------

/** All SpendRail engines that the adapter can use */
export interface SpendRailEngines {
  /** Policy evaluation engine (required) */
  readonly policyEngine: PolicyEngine;

  /** Transaction recorder (required) */
  readonly spendTracker: SpendTracker;

  /** Alert evaluation engine (optional) */
  readonly spendAlerts?: SpendAlerts;

  /** Audit trail recorder (optional) */
  readonly provenance?: TransactionProvenance;
}

// ---------------------------------------------------------------------------
// SpendRailX402Adapter
// ---------------------------------------------------------------------------

/**
 * SpendRailX402Adapter bridges the x402 payment protocol with SpendRail's
 * spending controls, observability, and audit infrastructure.
 *
 * It provides three integration surfaces:
 * - **Lifecycle hooks** for x402 servers (onBeforeVerify, onAfterSettle, etc.)
 * - **FacilitatorClient wrapper** that adds policy checks to verify/settle
 * - **ResourceServerExtension** that injects SpendRail metadata into responses
 *
 * @example
 * ```ts
 * import { SpendRailX402Adapter } from '@spendrail/x402';
 * import { PolicyEngine } from '@spendrail/control';
 * import { SpendTracker, SpendAlerts } from '@spendrail/observe';
 * import { TransactionProvenance } from '@spendrail/protect';
 *
 * const adapter = new SpendRailX402Adapter(
 *   {
 *     policyEngine: new PolicyEngine(),
 *     spendTracker: new SpendTracker(),
 *     spendAlerts: new SpendAlerts(tracker),
 *     provenance: new TransactionProvenance(),
 *   },
 *   { logger: console, defaultCurrency: 'USDC' },
 * );
 *
 * // Option 1: Register hooks on an x402 server
 * adapter.withLifecycleHooks(x402Server);
 *
 * // Option 2: Wrap a facilitator client
 * const wrappedClient = adapter.wrapFacilitatorClient(facilitatorClient);
 *
 * // Option 3: Create a resource server extension
 * const extension = adapter.createExtension();
 * ```
 */
export class SpendRailX402Adapter {
  private readonly engines: SpendRailEngines;
  private readonly config: Required<Pick<X402SpendRailConfig, 'abortOnPolicyDeny' | 'defaultCurrency' | 'sessionId' | 'failOpen'>> & X402SpendRailConfig;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger?: Logger;

  /** In-flight transaction context, keyed by transaction key */
  private readonly contexts: Map<string, X402TransactionContext> = new Map();

  constructor(engines: SpendRailEngines, config: X402SpendRailConfig = {}) {
    this.engines = engines;
    this.config = {
      abortOnPolicyDeny: true,
      failOpen: false,
      defaultCurrency: 'USDC',
      sessionId: `sr_session_${Date.now().toString(36)}`,
      ...config,
    };
    this.logger = config.logger;
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, this.logger);
  }

  // =========================================================================
  // 1. Lifecycle Hooks
  // =========================================================================

  /**
   * Register SpendRail lifecycle hooks on an x402 server.
   * This is the primary integration point for x402 server operators.
   *
   * Hooks registered:
   * - `onBeforeVerify`: Policy check — can abort if policy denies
   * - `onAfterVerify`: Record provenance and verification data
   * - `onVerifyFailure`: Update circuit breaker on facilitator failures
   * - `onBeforeSettle`: Final amount/policy re-check before settlement
   * - `onAfterSettle`: Record transaction, provenance, trigger alerts
   * - `onSettleFailure`: Update circuit breaker, classify retry eligibility
   *
   * @param server - The x402 server instance
   */
  withLifecycleHooks(server: X402Server): void {
    const hooks: X402ServerHooks = {
      onBeforeVerify: this.handleBeforeVerify.bind(this),
      onAfterVerify: this.handleAfterVerify.bind(this),
      onVerifyFailure: this.handleVerifyFailure.bind(this),
      onBeforeSettle: this.handleBeforeSettle.bind(this),
      onAfterSettle: this.handleAfterSettle.bind(this),
      onSettleFailure: this.handleSettleFailure.bind(this),
    };

    server.use(hooks);
    this.logger?.info('[SpendRailX402] Lifecycle hooks registered on x402 server');
  }

  // =========================================================================
  // 2. FacilitatorClient Wrapper
  // =========================================================================

  /**
   * Wrap an x402 FacilitatorClient with SpendRail policy checks,
   * circuit breaker protection, and observability.
   *
   * The wrapped client:
   * - **verify()**: Runs policy check before delegating, records provenance after
   * - **settle()**: Runs final check before delegating, records transaction after
   * - **supported()**: Delegates directly (no SpendRail logic needed)
   *
   * @param client - The original x402 FacilitatorClient
   * @param facilitatorKey - Identifier for circuit breaker (e.g., facilitator URL)
   * @returns A wrapped FacilitatorClient with the same interface
   */
  wrapFacilitatorClient(
    client: X402FacilitatorClient,
    facilitatorKey: string = 'default',
  ): X402FacilitatorClient {
    const self = this;

    return {
      async verify(
        paymentPayload: X402PaymentPayload,
        paymentRequirements: X402PaymentRequirements,
      ): Promise<X402VerifyResponse> {
        const tx = await mapToTransaction(paymentPayload, paymentRequirements, self.config);
        const txKey = transactionKey(paymentPayload, paymentRequirements);

        // Pre-check: policy evaluation
        const policyResult = self.engines.policyEngine.evaluate(tx);
        self.logger?.info(`[SpendRailX402] verify pre-check: ${policyResult.action}`, {
          txKey,
          reason: policyResult.reason,
        });

        if (!policyResult.allowed && self.config.abortOnPolicyDeny) {
          self.engines.provenance?.recordPolicyCheck(tx.id, 'fail', {
            action: policyResult.action,
            reason: policyResult.reason,
          });
          return {
            isValid: false,
            invalidReason: `SpendRail policy denied: ${policyResult.reason}`,
          };
        }

        // Record provenance for policy check
        self.engines.provenance?.recordPolicyCheck(
          tx.id,
          policyResult.allowed ? 'pass' : 'fail',
          { action: policyResult.action, reason: policyResult.reason },
        );

        // Delegate to real facilitator through circuit breaker
        const verifyResponse = await self.circuitBreaker.execute(
          facilitatorKey,
          () => client.verify(paymentPayload, paymentRequirements),
        );

        // Post-log: record verification
        self.engines.provenance?.recordExecution(tx.id, verifyResponse.isValid ? 'pass' : 'fail', {
          stage: 'verify',
          isValid: verifyResponse.isValid,
          invalidReason: verifyResponse.invalidReason,
          payer: verifyResponse.payer,
        });

        // Store context for later settle
        self.contexts.set(txKey, {
          transaction: tx,
          policyResult,
          verifyData: { ...verifyResponse },
          timestamps: {
            created: tx.createdAt,
            verified: new Date().toISOString(),
          },
        });

        return verifyResponse;
      },

      async settle(
        paymentPayload: X402PaymentPayload,
        paymentRequirements: X402PaymentRequirements,
      ): Promise<X402SettleResponse> {
        const txKey = transactionKey(paymentPayload, paymentRequirements);
        let ctx = self.contexts.get(txKey);
        let tx: AgentTransaction;

        if (ctx) {
          tx = ctx.transaction;
        } else {
          // No context from verify — create fresh transaction
          tx = await mapToTransaction(paymentPayload, paymentRequirements, self.config);
          ctx = {
            transaction: tx,
            timestamps: { created: tx.createdAt },
          };
        }

        // Pre-check: final amount/policy re-validation
        const policyResult = self.engines.policyEngine.evaluate(tx);
        if (!policyResult.allowed && self.config.abortOnPolicyDeny) {
          self.logger?.warn('[SpendRailX402] settle pre-check DENIED', {
            txKey,
            reason: policyResult.reason,
          });
          self.engines.provenance?.recordSettlement(tx.id, 'fail', {
            reason: `Policy denied at settlement: ${policyResult.reason}`,
          });
          return {
            success: false,
            txHash: undefined,
          };
        }

        // Delegate to real facilitator through circuit breaker
        const settleResponse = await self.circuitBreaker.execute(
          facilitatorKey,
          () => client.settle(paymentPayload, paymentRequirements),
        );

        // Post-log: record everything
        if (settleResponse.success) {
          tx.status = 'completed';
          tx.updatedAt = new Date().toISOString();
          tx.protocolTxId = settleResponse.txHash;

          // Record in SpendTracker
          self.engines.spendTracker.record(tx);

          // Record in PolicyEngine spend counters
          self.engines.policyEngine.recordTransaction(tx);

          // Record provenance
          self.engines.provenance?.recordSettlement(tx.id, 'pass', {
            txHash: settleResponse.txHash,
            network: settleResponse.network,
          });

          // Trigger alert evaluation
          if (self.engines.spendAlerts) {
            // Fire and forget — alerts should not block settlement
            self.engines.spendAlerts.evaluate(tx).catch((err) => {
              self.logger?.error('[SpendRailX402] Alert evaluation failed', err);
            });
          }
        } else {
          tx.status = 'failed';
          tx.updatedAt = new Date().toISOString();
          self.engines.spendTracker.record(tx);
          self.engines.provenance?.recordSettlement(tx.id, 'fail', {
            ...settleResponse,
          });
        }

        // Update context
        ctx.settleData = { ...settleResponse };
        ctx.timestamps.settled = new Date().toISOString();
        self.contexts.set(txKey, ctx);

        return settleResponse;
      },

      async supported(): Promise<{ schemes: string[]; networks: string[] }> {
        // Pure delegation — no SpendRail logic needed
        return client.supported();
      },
    };
  }

  // =========================================================================
  // 3. ResourceServerExtension
  // =========================================================================

  /**
   * Create an x402 ResourceServerExtension that injects SpendRail
   * metadata into HTTP responses.
   *
   * - `enrichPaymentRequiredResponse`: Adds SpendRail session ID and
   *   policy hints to the 402 response, so the client knows about
   *   spending limits before paying.
   * - `enrichSettlementResponse`: Adds receipt data and audit trail
   *   reference to the settlement response.
   *
   * @returns An x402 ResourceServerExtension
   */
  createExtension(): X402ResourceServerExtension {
    const self = this;

    return {
      key: 'spendrail',

      enrichPaymentRequiredResponse(
        requirements: X402PaymentRequirements,
      ): Record<string, unknown> {
        return {
          spendrail: {
            sessionId: self.config.sessionId,
            version: '1.0.0',
            controlsActive: true,
            recipient: requirements.payTo,
          },
        };
      },

      enrichSettlementResponse(
        settlementResponse: X402SettleResponse,
        paymentPayload: X402PaymentPayload,
        paymentRequirements: X402PaymentRequirements,
      ): Record<string, unknown> {
        const txKey = transactionKey(paymentPayload, paymentRequirements);
        const ctx = self.contexts.get(txKey);

        return {
          spendrail: {
            sessionId: self.config.sessionId,
            transactionId: ctx?.transaction.id,
            policyAction: ctx?.policyResult?.action ?? 'unknown',
            recorded: !!ctx,
            timestamps: ctx?.timestamps,
          },
        };
      },
    };
  }

  // =========================================================================
  // Public Utilities
  // =========================================================================

  /**
   * Get the circuit breaker instance for advanced monitoring/control.
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Get a transaction context by its x402 payment key.
   * Returns undefined if no context exists (e.g., before verify).
   */
  getContext(
    payload: X402PaymentPayload,
    requirements: X402PaymentRequirements,
  ): X402TransactionContext | undefined {
    const key = transactionKey(payload, requirements);
    return this.contexts.get(key);
  }

  /**
   * Get the adapter's session ID.
   */
  getSessionId(): string {
    return this.config.sessionId;
  }

  // =========================================================================
  // Private Lifecycle Hook Handlers
  // =========================================================================

  /**
   * onBeforeVerify: Run policy evaluation. If denied, abort the verify step.
   */
  private async handleBeforeVerify(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Promise<{ abort?: boolean; reason?: string } | void> {
    try {
      const tx = await mapToTransaction(paymentPayload, paymentRequirements, this.config);
      const txKey = transactionKey(paymentPayload, paymentRequirements);

      // Record intent provenance
      this.engines.provenance?.recordIntent(tx, {
        source: 'x402-lifecycle',
        resource: paymentPayload.resource,
      });

      // Evaluate policy
      const policyResult = this.engines.policyEngine.evaluate(tx);

      this.logger?.info(`[SpendRailX402] onBeforeVerify: ${policyResult.action}`, {
        txKey,
        amount: tx.amount,
        currency: tx.currency,
        recipient: tx.recipient,
      });

      // Record policy check in provenance
      this.engines.provenance?.recordPolicyCheck(
        tx.id,
        policyResult.allowed ? 'pass' : 'fail',
        {
          action: policyResult.action,
          reason: policyResult.reason,
          details: policyResult.details,
        },
      );

      // Store context for later hooks
      this.contexts.set(txKey, {
        transaction: tx,
        policyResult,
        timestamps: { created: tx.createdAt },
      });

      if (!policyResult.allowed && this.config.abortOnPolicyDeny) {
        return {
          abort: true,
          reason: `SpendRail policy denied: ${policyResult.reason}`,
        };
      }
    } catch (error) {
      this.logger?.error('[SpendRailX402] onBeforeVerify error', error);
      if (!this.config.failOpen) {
        return { abort: true, reason: 'SpendRail internal error — payment blocked for safety' };
      }
    }
  }

  /**
   * onAfterVerify: Record verification data in provenance and context.
   */
  private async handleAfterVerify(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    verifyResponse: X402VerifyResponse,
  ): Promise<void> {
    try {
      const txKey = transactionKey(paymentPayload, paymentRequirements);
      const ctx = this.contexts.get(txKey);

      if (ctx) {
        ctx.verifyData = { ...verifyResponse };
        ctx.timestamps.verified = new Date().toISOString();

        this.engines.provenance?.recordExecution(ctx.transaction.id, verifyResponse.isValid ? 'pass' : 'fail', {
          stage: 'verify',
          isValid: verifyResponse.isValid,
          invalidReason: verifyResponse.invalidReason,
          payer: verifyResponse.payer,
        });
      }

      this.logger?.info('[SpendRailX402] onAfterVerify', {
        txKey,
        isValid: verifyResponse.isValid,
      });
    } catch (error) {
      this.logger?.error('[SpendRailX402] onAfterVerify error', error);
    }
  }

  /**
   * onVerifyFailure: Update circuit breaker state on facilitator failure.
   */
  private async handleVerifyFailure(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    error: unknown,
  ): Promise<void> {
    const txKey = transactionKey(paymentPayload, paymentRequirements);
    const ctx = this.contexts.get(txKey);

    this.logger?.error('[SpendRailX402] onVerifyFailure', {
      txKey,
      error: error instanceof Error ? error.message : String(error),
    });

    // Record failure in provenance
    if (ctx) {
      this.engines.provenance?.recordExecution(ctx.transaction.id, 'fail', {
        stage: 'verify',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // The circuit breaker is updated automatically when using wrapFacilitatorClient.
    // For lifecycle hooks, we record the failure but the breaker is managed
    // at the facilitator client level, not the server hook level.
  }

  /**
   * onBeforeSettle: Final amount/policy re-check before committing funds.
   */
  private async handleBeforeSettle(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Promise<{ abort?: boolean; reason?: string } | void> {
    try {
      const txKey = transactionKey(paymentPayload, paymentRequirements);
      const ctx = this.contexts.get(txKey);

      if (!ctx) {
        this.logger?.warn('[SpendRailX402] onBeforeSettle: no context found (verify may have been skipped)', { txKey });
        return;
      }

      // Re-evaluate policy (amounts or budgets may have changed since verify)
      const policyResult = this.engines.policyEngine.evaluate(ctx.transaction);

      this.logger?.info(`[SpendRailX402] onBeforeSettle: ${policyResult.action}`, {
        txKey,
        amount: ctx.transaction.amount,
      });

      if (!policyResult.allowed && this.config.abortOnPolicyDeny) {
        this.engines.provenance?.recordSettlement(ctx.transaction.id, 'fail', {
          reason: `Policy re-check denied at settlement: ${policyResult.reason}`,
        });
        return {
          abort: true,
          reason: `SpendRail policy denied at settlement: ${policyResult.reason}`,
        };
      }
    } catch (error) {
      this.logger?.error('[SpendRailX402] onBeforeSettle error', error);
      if (!this.config.failOpen) {
        return { abort: true, reason: 'SpendRail internal error — settlement blocked for safety' };
      }
    }
  }

  /**
   * onAfterSettle: Record the completed transaction across all SpendRail engines.
   */
  private async handleAfterSettle(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    settleResponse: X402SettleResponse,
  ): Promise<void> {
    try {
      const txKey = transactionKey(paymentPayload, paymentRequirements);
      let ctx = this.contexts.get(txKey);

      if (!ctx) {
        // Create context for transactions that bypassed our verify hook
        const tx = await mapToTransaction(paymentPayload, paymentRequirements, this.config);
        ctx = {
          transaction: tx,
          timestamps: { created: tx.createdAt },
        };
      }

      const tx = ctx.transaction;

      if (settleResponse.success) {
        tx.status = 'completed';
        tx.updatedAt = new Date().toISOString();
        tx.protocolTxId = settleResponse.txHash;
      } else {
        tx.status = 'failed';
        tx.updatedAt = new Date().toISOString();
      }

      // Record in SpendTracker
      this.engines.spendTracker.record(tx);

      // Update PolicyEngine spend counters
      if (settleResponse.success) {
        this.engines.policyEngine.recordTransaction(tx);
      }

      // Record provenance
      this.engines.provenance?.recordSettlement(
        tx.id,
        settleResponse.success ? 'pass' : 'fail',
        {
          txHash: settleResponse.txHash,
          network: settleResponse.network,
        },
      );

      // Evaluate alert rules (fire and forget)
      if (this.engines.spendAlerts) {
        this.engines.spendAlerts.evaluate(tx).catch((err) => {
          this.logger?.error('[SpendRailX402] Alert evaluation failed', err);
        });
      }

      // Update context
      ctx.settleData = { ...settleResponse };
      ctx.timestamps.settled = new Date().toISOString();
      this.contexts.set(txKey, ctx);

      this.logger?.info('[SpendRailX402] onAfterSettle', {
        txKey,
        transactionId: tx.id,
        success: settleResponse.success,
        txHash: settleResponse.txHash,
      });
    } catch (error) {
      this.logger?.error('[SpendRailX402] onAfterSettle error', error);
    }
  }

  /**
   * onSettleFailure: Record failure, update circuit breaker, classify retry eligibility.
   */
  private async handleSettleFailure(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
    error: unknown,
  ): Promise<void> {
    const txKey = transactionKey(paymentPayload, paymentRequirements);
    const ctx = this.contexts.get(txKey);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryable = classifyRetryability(error);

    this.logger?.error('[SpendRailX402] onSettleFailure', {
      txKey,
      error: errorMessage,
      retryable,
    });

    if (ctx) {
      const tx = ctx.transaction;
      tx.status = 'failed';
      tx.updatedAt = new Date().toISOString();

      this.engines.spendTracker.record(tx);

      this.engines.provenance?.recordSettlement(tx.id, 'fail', {
        error: errorMessage,
        retryable,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Classify whether a settlement failure is retryable.
 * Network errors and timeouts are retryable. Auth errors and business logic
 * failures are not.
 */
function classifyRetryability(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();

  // Network-level errors — retryable
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused')) {
    return true;
  }
  if (msg.includes('network') || msg.includes('socket') || msg.includes('dns')) {
    return true;
  }
  if (msg.includes('503') || msg.includes('502') || msg.includes('429')) {
    return true;
  }

  // Business logic / auth errors — not retryable
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid')) {
    return false;
  }
  if (msg.includes('insufficient') || msg.includes('denied')) {
    return false;
  }

  // Unknown errors — default not retryable (conservative)
  return false;
}

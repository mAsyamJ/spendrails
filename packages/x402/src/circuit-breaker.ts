// =============================================================================
// CircuitBreaker — Protects against cascading failures in facilitator calls
// Maintains per-facilitator state: closed -> open -> half-open -> closed
// =============================================================================

import type { Logger } from '@spendrail/core';
import type { CircuitBreakerConfig, CircuitBreakerState } from './types.js';

/** Internal state for a single circuit breaker instance */
interface BreakerState {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  halfOpenRequests: number;
}

/** Default circuit breaker configuration */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30_000,
  halfOpenMaxRequests: 1,
};

/**
 * CircuitBreaker prevents repeated calls to failing facilitators.
 *
 * State machine:
 * - **closed**: Normal operation. Failures increment a counter.
 *   When `failureThreshold` is reached, transitions to open.
 * - **open**: All calls are rejected immediately.
 *   After `recoveryTimeoutMs`, transitions to half-open.
 * - **half-open**: A limited number of probe calls are allowed.
 *   If they succeed, transitions back to closed.
 *   If they fail, transitions back to open.
 *
 * Maintains independent breaker state per facilitator URL, so a failing
 * facilitator on one network does not block calls to a healthy one.
 *
 * @example
 * ```ts
 * const breaker = new CircuitBreaker({ failureThreshold: 3 });
 *
 * const result = await breaker.execute('https://facilitator.example.com', async () => {
 *   return await facilitatorClient.verify(payload, requirements);
 * });
 * ```
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly breakers: Map<string, BreakerState> = new Map();
  private readonly logger?: Logger;

  constructor(config?: Partial<CircuitBreakerConfig>, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws if the circuit is open or if the wrapped function throws.
   *
   * @param key - Breaker key (typically facilitator URL or endpoint identifier)
   * @param fn - The async function to protect
   * @returns The result of `fn`
   * @throws {CircuitBreakerOpenError} if the circuit is open and recovery timeout has not elapsed
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getOrCreate(key);

    // Check if we should transition from open to half-open
    if (breaker.state === 'open') {
      const elapsed = Date.now() - breaker.lastFailureTime;
      if (elapsed >= this.config.recoveryTimeoutMs) {
        this.transitionTo(key, breaker, 'half-open');
      } else {
        const remainingMs = this.config.recoveryTimeoutMs - elapsed;
        this.logger?.warn(`[CircuitBreaker] Circuit OPEN for "${key}" — rejecting call (${remainingMs}ms until half-open)`);
        throw new CircuitBreakerOpenError(key, remainingMs);
      }
    }

    // In half-open, limit concurrent probe requests
    if (breaker.state === 'half-open') {
      if (breaker.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        this.logger?.warn(`[CircuitBreaker] Half-open limit reached for "${key}" — rejecting call`);
        throw new CircuitBreakerOpenError(key, 0);
      }
      breaker.halfOpenRequests++;
    }

    // Execute the protected function
    try {
      const result = await fn();
      this.onSuccess(key, breaker);
      return result;
    } catch (error) {
      this.onFailure(key, breaker);
      throw error;
    }
  }

  /**
   * Get the current state for a breaker key.
   * Returns 'closed' if no breaker exists for the key.
   */
  getState(key: string): CircuitBreakerState {
    const breaker = this.breakers.get(key);
    if (!breaker) return 'closed';

    // Check for auto-transition from open -> half-open
    if (breaker.state === 'open') {
      const elapsed = Date.now() - breaker.lastFailureTime;
      if (elapsed >= this.config.recoveryTimeoutMs) {
        return 'half-open';
      }
    }

    return breaker.state;
  }

  /**
   * Manually reset a breaker to closed state.
   * Useful for administrative overrides.
   */
  reset(key: string): void {
    const breaker = this.breakers.get(key);
    if (breaker) {
      this.transitionTo(key, breaker, 'closed');
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.halfOpenRequests = 0;
    }
    this.logger?.info(`[CircuitBreaker] Manually reset breaker for "${key}"`);
  }

  /**
   * Reset all breakers to closed state.
   */
  resetAll(): void {
    for (const [key] of this.breakers) {
      this.reset(key);
    }
  }

  /**
   * Get a snapshot of all breaker states.
   */
  getSnapshot(): ReadonlyMap<string, { state: CircuitBreakerState; failureCount: number }> {
    const snapshot = new Map<string, { state: CircuitBreakerState; failureCount: number }>();
    for (const [key, breaker] of this.breakers) {
      snapshot.set(key, {
        state: this.getState(key),
        failureCount: breaker.failureCount,
      });
    }
    return snapshot;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getOrCreate(key: string): BreakerState {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
      };
      this.breakers.set(key, breaker);
    }
    return breaker;
  }

  private onSuccess(key: string, breaker: BreakerState): void {
    if (breaker.state === 'half-open') {
      // Probe succeeded — close the circuit
      this.transitionTo(key, breaker, 'closed');
      breaker.failureCount = 0;
      breaker.halfOpenRequests = 0;
    }
    breaker.successCount++;
  }

  private onFailure(key: string, breaker: BreakerState): void {
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.state === 'half-open') {
      // Probe failed — re-open the circuit
      this.transitionTo(key, breaker, 'open');
      breaker.halfOpenRequests = 0;
    } else if (breaker.state === 'closed') {
      if (breaker.failureCount >= this.config.failureThreshold) {
        this.transitionTo(key, breaker, 'open');
      }
    }
  }

  private transitionTo(key: string, breaker: BreakerState, newState: CircuitBreakerState): void {
    const oldState = breaker.state;
    if (oldState === newState) return;

    breaker.state = newState;
    this.logger?.info(`[CircuitBreaker] "${key}" transitioned: ${oldState} -> ${newState}`, {
      failureCount: breaker.failureCount,
    });
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Error thrown when a circuit breaker is open and rejects a call.
 */
export class CircuitBreakerOpenError extends Error {
  /** The breaker key that is open */
  readonly breakerKey: string;

  /** Milliseconds remaining until the breaker transitions to half-open */
  readonly remainingMs: number;

  constructor(key: string, remainingMs: number) {
    super(`Circuit breaker open for "${key}" — ${remainingMs}ms until recovery`);
    this.name = 'CircuitBreakerOpenError';
    this.breakerKey = key;
    this.remainingMs = remainingMs;
  }
}

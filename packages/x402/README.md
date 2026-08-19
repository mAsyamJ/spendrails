# @spendrail/x402

x402 protocol adapter for SpendRail. Adds spending limits, circuit breakers, and full observability to HTTP 402 payments made by AI agents.

## Quick Start

```ts
import { SpendRailX402Adapter } from '@spendrail/x402';
import { PolicyEngine } from '@spendrail/control';
import { SpendTracker } from '@spendrail/observe';

const adapter = new SpendRailX402Adapter(
  { policyEngine: new PolicyEngine(), spendTracker: new SpendTracker() },
  { logger: console },
);

// Register hooks on your x402 server
adapter.withLifecycleHooks(x402Server);
```

## Features

- **Policy enforcement** — Evaluate every x402 payment against declarative spend policies before verify and settle
- **Circuit breaker** — Per-facilitator circuit breakers protect against cascading failures (closed/open/half-open)
- **Full audit trail** — Every lifecycle stage (intent, policy check, verify, settle) recorded in TransactionProvenance
- **Alert integration** — Completed transactions trigger SpendAlerts evaluation (budget thresholds, anomalies, rate spikes)
- **Transaction mapping** — Automatic conversion from x402 PaymentPayload/Requirements to SpendRail AgentTransaction
- **Response enrichment** — ResourceServerExtension injects SpendRail session ID and audit metadata into 402/200 responses
- **Zero side effects** — Pure classes and functions; nothing runs until you call it

## Integration Surfaces

### 1. Lifecycle Hooks (x402 server)

```ts
adapter.withLifecycleHooks(server);
```

Registers all 6 x402 lifecycle hooks: `onBeforeVerify`, `onAfterVerify`, `onVerifyFailure`, `onBeforeSettle`, `onAfterSettle`, `onSettleFailure`.

### 2. FacilitatorClient Wrapper

```ts
const wrappedClient = adapter.wrapFacilitatorClient(facilitatorClient, 'https://facilitator.example.com');
```

Wraps `verify()` and `settle()` with policy checks, circuit breaker, and provenance recording. Drop-in replacement.

### 3. ResourceServerExtension

```ts
const extension = adapter.createExtension();
// Register with your x402 server as an extension
```

Enriches 402 responses with SpendRail session metadata and settlement responses with audit data.

## Configuration

```ts
const adapter = new SpendRailX402Adapter(engines, {
  logger: console,                    // Structured logger
  defaultAgentId: 'my-agent' as AgentId, // Fallback agent ID
  defaultCurrency: 'USDC',           // Default currency (default: 'USDC')
  abortOnPolicyDeny: true,           // Abort x402 flow on policy deny (default: true)
  sessionId: 'sr_custom_session',    // Custom session ID
  resolveAgentId: async (addr) => {  // Custom agent ID resolver
    return lookupAgent(addr);
  },
  circuitBreaker: {
    failureThreshold: 5,             // Failures before opening (default: 5)
    recoveryTimeoutMs: 30000,        // ms before half-open (default: 30000)
    halfOpenMaxRequests: 1,          // Probe requests in half-open (default: 1)
  },
});
```

## Links

- [x402 Protocol](https://github.com/coinbase/x402)
- [SpendRail](https://github.com/mAsyamJ/spendrail)

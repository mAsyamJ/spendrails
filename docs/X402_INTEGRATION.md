# x402 integration

`@spendrail/x402` attaches SpendRail policy evaluation to the HTTP 402 payment
protocol without putting an LLM on the authorization path.

## Adapter

`SpendRailX402Adapter` has three surfaces:

1. **Lifecycle hooks** — `onBeforeVerify`, `onAfterVerify`, `onVerifyFailure`,
   `onBeforeSettle`, `onAfterSettle`, `onSettleFailure`
2. **Facilitator wrapper** — policy pre-check around `verify` / `settle`
3. **Resource extension** — injects `spendrail` session and audit metadata

```typescript
import { SpendRailX402Adapter } from '@spendrail/x402';

const adapter = new SpendRailX402Adapter(
  { policyEngine, spendTracker, spendAlerts, provenance },
  {
    abortOnPolicyDeny: true,
    failOpen: false,
    circuitBreaker: { failureThreshold: 5, recoveryTimeoutMs: 30_000 },
  },
);

adapter.withLifecycleHooks(server);
```

## Fail-closed behavior

- Policy BLOCK aborts verify and settle.
- Adapter exceptions abort rather than paying.
- `failOpen` defaults to `false`.

## Circuit breaker

Repeated facilitator or settlement failures open a breaker so retry storms do
not drain a wallet. While open, new calls fail fast. After
`recoveryTimeoutMs`, a limited probe may close the breaker.

This exists because x402 settlement can take payment and still return an
application error, and naive retries can duplicate spend. SpendRail records
failures, trips the breaker, and keeps authorization in the policy engine.

## Mapping

x402 payload + requirements are mapped to a SpendRail `AgentTransaction`
(`mapToTransaction`) so the same policy, tracker, and provenance stack used by
MCP and `SpendRailWallet` applies to HTTP 402 payments.

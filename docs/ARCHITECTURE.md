# Architecture

SpendRail is programmable spending authority for AI agents and autonomous software.

The agent may create a payment intent. SpendRail evaluates that intent against a
declarative policy, then either allows execution, asks a human, or blocks the
payment before a wallet adapter is invoked.

```
AI Agent
    ↓
SpendRail MCP / SDK
    ↓
Financial Policy Engine
    ↓
ALLOW / ASK / BLOCK
    ↓
Wallet Adapter
    ↓
Payment Rail
```

## Packages

| Package | Responsibility |
| --- | --- |
| `@spendrail/core` | Payment intent types, identifiers, event bus, storage adapter |
| `@spendrail/control` | Deterministic `PolicyEngine`, rules, budgets, cooldowns |
| `@spendrail/observe` | Spend tracker, analytics, anomaly alerts |
| `@spendrail/protect` | Provenance chain, disputes, recovery |
| `@spendrail/wallet` | `SpendRailWallet` orchestrator and wallet adapters |
| `@spendrail/x402` | `SpendRailX402Adapter`, circuit breaker, transaction mapping |
| `@spendrail/sandbox` | Mock x402 / ACP / AP2 rails |
| `@spendrail/mcp` | MCP tools over `SpendRailStack` |
| `@spendrail/a2a` | Intents, mandates, escrow, agent registry |
| `@spendrail/dashboard` | JSON + SSE operational API |

## Control flow

1. An agent submits a payment intent (recipient, amount, currency, purpose, protocol).
2. `PolicyEngine.evaluate` runs budgets, cooldowns, then first-match rules.
3. Observe records and may emit alerts; it does not authorize.
4. Protect records provenance around the decision.
5. Only ALLOW proceeds to a wallet adapter or sandbox rail.
6. ASK waits for explicit approval. BLOCK never reaches the wallet.

Authorization is fail-closed. Missing approval handlers, policy denials, and
internal evaluation errors do not spend.

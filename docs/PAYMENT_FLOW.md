# Payment flow

A payment is a `payment intent` that flows through SpendRail before any wallet
adapter is allowed to sign.

```
AI Agent
    ↓
SpendRail MCP / SDK
    ↓
Payment Intent
    ↓
Deterministic Policy Engine
    ↓
ALLOW / ASK / BLOCK
    ↓
Wallet Adapter
    ↓
Payment Rail
```

## Steps

1. **Create intent** — agent, recipient, amount, currency, purpose, protocol.
2. **Evaluate policy** — budgets, cooldowns, recipient and amount rules.
3. **Record the decision** — tracker + provenance + events.
4. **Branch**
   - BLOCK: return a denied result. Stop.
   - ASK: wait for explicit approval. Timeout denies.
   - ALLOW: optional balance pre-check, then wallet adapter `signAndSend`.
5. **Settle or fail** — record receipt or failure; alerts may fire; circuit
   breakers may open on rail errors.

`SpendRailWallet.executePayment` is the SDK path. `SpendRailX402Adapter`
inserts the same evaluation into x402 verify/settle hooks. `SpendRailStack`
is the MCP/sandbox path.

The agent never calls the wallet directly.

# SpendRail

**Give AI a budget, not your wallet.**

SpendRail is programmable financial permission infrastructure for AI agents
and autonomous software.

AI can reason and request payments.

SpendRail decides whether it is allowed to spend.

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

The agent may reason about a purchase. It is not the final financial authority.
SpendRail authorization is deterministic.

## What it controls

- Per-transaction limits
- Hourly, daily, and monthly budgets
- Vendor / approved-recipient restrictions
- Purpose restrictions
- Human approval thresholds
- Rate limits
- Wallet abstraction (the agent never holds the keys)
- x402 support
- Spend tracking
- Anomaly alerts
- Audit trail
- Circuit breakers
- Recurring payment mandates
- MCP integration
- Sandbox / testnet execution

## Demo policy

| Control | Value |
| --- | --- |
| Daily budget | $5 |
| ALLOW | under $1 |
| ASK | $1–$2 |
| BLOCK | above $2 |

Examples:

| Intent | Amount | Result |
| --- | --- | --- |
| Research API | $0.20 | ALLOW |
| Premium Dataset | $1.50 | ASK |
| Unknown provider | $20 | BLOCK |

```bash
npx spendrail-demo
```

## Architecture

SpendRail is a TypeScript workspace of focused packages:

| Package | Role |
| --- | --- |
| `@spendrail/core` | Shared types, payment intents, event bus, identifiers |
| `@spendrail/control` | Deterministic policy engine |
| `@spendrail/observe` | Spend tracking, analytics, alerts |
| `@spendrail/protect` | Provenance, disputes, recovery |
| `@spendrail/wallet` | Wallet adapters behind policy |
| `@spendrail/x402` | x402 protocol adapter and circuit breaker |
| `@spendrail/sandbox` | Mock payment rails for tests |
| `@spendrail/mcp` | MCP server (`spendrail-mcp`) |
| `@spendrail/a2a` | Agent-to-agent intents, mandates, escrow |
| `@spendrail/dashboard` | JSON/SSE status API (`spendrail-dashboard`) |

Authorization never calls an LLM. Policy evaluation is fail-closed.

## Quick start

```bash
npm install @spendrail/core @spendrail/control @spendrail/observe
```

```typescript
import { PolicyEngine, blockAbove, requireApprovalAbove, allowAll } from '@spendrail/control';
import { createTransaction } from '@spendrail/core';

const engine = new PolicyEngine();

engine.loadPolicy({
  id: 'demo',
  name: 'Demo spending authority',
  enabled: true,
  rules: [
    blockAbove(2, 'USD'),
    requireApprovalAbove(1, 'USD'),
    allowAll(),
  ],
  budgets: [
    { window: 'daily', maxAmount: 5, currency: 'USD' },
  ],
});

const result = engine.evaluate(createTransaction({
  agentId: 'research-agent',
  recipient: 'research-api.example',
  amount: 0.2,
  currency: 'USD',
  purpose: 'Research API query',
  protocol: 'x402',
}));

// result.action: 'allow' | 'require_approval' | 'deny' | 'flag'
// Product language: ALLOW / ASK / BLOCK
```

Wallet orchestration:

```bash
npm install @spendrail/wallet
```

```typescript
import { createWallet } from '@spendrail/wallet';

const wallet = createWallet({
  limits: { perTx: 2, daily: 5, approvalAbove: 1 },
});

const payment = await wallet.executePayment({
  recipient: 'research-api.example',
  amount: 0.2,
  purpose: 'Research API query',
});
```

x402:

```bash
npm install @spendrail/x402
```

```typescript
import { SpendRailX402Adapter } from '@spendrail/x402';
import { PolicyEngine } from '@spendrail/control';
import { SpendTracker } from '@spendrail/observe';

const adapter = new SpendRailX402Adapter(
  { policyEngine: new PolicyEngine(), spendTracker: new SpendTracker() },
  { circuitBreaker: { failureThreshold: 5, recoveryTimeoutMs: 30_000 } },
);

adapter.withLifecycleHooks(yourX402Server);
```

## MCP setup

```bash
npx spendrail-mcp
```

```json
{
  "mcpServers": {
    "spendrail": {
      "command": "npx",
      "args": ["spendrail-mcp"]
    }
  }
}
```

Optional environment variables: `SPENDRAIL_MAX_PER_TX`, `SPENDRAIL_MAX_DAILY`,
`SPENDRAIL_MAX_HOURLY`, `SPENDRAIL_APPROVAL_ABOVE`, `SPENDRAIL_INITIAL_BALANCE`,
`SPENDRAIL_CURRENCY`.

See [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md) and
[docs/HERMES_DEMO.md](docs/HERMES_DEMO.md).

## Security model

```
Agent
    ↓
Payment Intent
    ↓
Deterministic Policy Engine
    ↓
ALLOW / ASK / BLOCK
```

- **BLOCK** — do not reach the wallet.
- **ASK** — require explicit approval.
- **ALLOW** — proceed to the wallet adapter.

LLM reasoning must not control authorization. See
[docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).

## Demo

The CLI demo uses the policy above, including a payment-storm circuit breaker
and a prompt-injection BLOCK.

```bash
npx spendrail-demo
```

Hermes-on-VPS walkthrough: [docs/HERMES_DEMO.md](docs/HERMES_DEMO.md).

## Development

```bash
git clone https://github.com/mAsyamJ/spendrail.git
cd spendrail
npm install
npm run build
npm run typecheck
npm test
npm run lint
```

Docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Policy engine](docs/POLICY_ENGINE.md)
- [Payment flow](docs/PAYMENT_FLOW.md)
- [x402 integration](docs/X402_INTEGRATION.md)
- [MCP integration](docs/MCP_INTEGRATION.md)
- [Roadmap](docs/ROADMAP.md)

## Current status

SpendRail is a working TypeScript workspace for programmable spending
authority: policy evaluation, wallet adapters, x402 hooks, MCP tools, sandbox
rails, and an audit trail.

It is not a hosted payments product and does not claim production certification.
Use sandbox or testnet adapters until you have reviewed the security model and
wallet custody design for your environment.

## License

MIT. Third-party notices: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES/).

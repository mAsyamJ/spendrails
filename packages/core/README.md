# @spendrail/core

Core types, configuration, and shared utilities for [SpendRail](https://github.com/mAsyamJ/spendrail) — programmable financial permissions for AI agents.

## Install

```bash
npm install @spendrail/core
```

## Usage

```typescript
import { createTransaction, type AgentTransaction } from '@spendrail/core';

const tx = createTransaction({
  agentId: 'research-agent',
  recipient: 'https://api.provider.com/data',
  amount: 0.05,
  currency: 'USDC',
  purpose: 'Market data API call',
  protocol: 'x402',
});
```

## What's included

| Export | Description |
|--------|-------------|
| `AgentTransaction` | Protocol-agnostic transaction type |
| `PaymentProtocol` | `'x402' \| 'acp' \| 'ap2' \| 'stripe'` |
| `TransactionStatus` | Lifecycle states |
| `PolicyResult` | Policy evaluation result |
| `createTransaction()` | Factory with defaults + ID generation |
| `validateTransaction()` | Runtime validation |

## Part of SpendRail

This is one package in the SpendRail workspace:

- **@spendrail/core** — Types & utilities (this package)
- **@spendrail/observe** — Spend tracking, analytics, alerts
- **@spendrail/control** — Policy engine, spending limits, approval workflows
- **@spendrail/protect** — Provenance, disputes, recovery
- **@spendrail/sandbox** — Mock protocols for testing without real money

## License

MIT

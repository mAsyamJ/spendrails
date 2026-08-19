# @spendrail/sandbox

Mock payment protocols for testing AI agent payments without real money. Simulate x402, ACP, and AP2 with configurable latency, failure rates, and edge cases.

Part of [SpendRail](https://github.com/mAsyamJ/spendrail).

## Install

```bash
npm install @spendrail/sandbox @spendrail/core
```

## Quick Start

```typescript
import { MockX402, MockACP, MockAP2 } from '@spendrail/sandbox';

// Simulate x402 with 10% failure rate
const x402 = new MockX402({
  latencyMs: 10,
  failureRate: 0.1,
});

const result = await x402.processPayment(tx);
console.log(result.success); // true 90% of the time

// Simulate ACP agent-to-agent
const acp = new MockACP({ latencyMs: 50 });
const negotiation = await acp.negotiate(tx);

// Simulate AP2
const ap2 = new MockAP2({ latencyMs: 20 });
const receipt = await ap2.processPayment(tx);
```

## Features

- **MockX402** — Simulates HTTP 402 payment flow with configurable timeouts and retries
- **MockACP** — Agent-to-agent negotiation simulation
- **MockAP2** — Next-gen protocol mock with receipts
- **Scenarios** — Pre-built edge cases (timeout storms, duplicate payments, network failures)
- **Zero cost** — Test your entire payment flow without spending a cent

## Environment Variable

Set `SPENDRAIL_MODE=sandbox` to route all payments through mocks automatically.

## License

MIT

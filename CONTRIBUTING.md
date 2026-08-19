# Contributing to SpendRail

## Prerequisites

- Node.js 18+
- npm 11+ (workspace-aware)

## Setup

```bash
git clone https://github.com/mAsyamJ/spendrail.git
cd spendrail
npm install
npm run build
npm run typecheck
npm test
```

## Package structure

```
packages/
  core/       # Types, payment intents, events
  control/    # Deterministic policy engine
  observe/    # Spend tracking and alerts
  protect/    # Provenance, disputes, recovery
  wallet/     # SpendRailWallet and adapters
  x402/       # x402 adapter and circuit breaker
  sandbox/    # Mock payment rails
  mcp/        # spendrail-mcp
  a2a/        # Agent-to-agent mandates
  dashboard/  # spendrail-dashboard
  demo/       # spendrail-demo
```

Packages publish under the `@spendrail` scope. CLI binaries are `spendrail-mcp`,
`spendrail-dashboard`, and `spendrail-demo`.

## Workflow

1. Fork and branch from `main`.
2. Keep authorization fail-closed. Do not put LLM calls in the policy path.
3. Add tests for behavior changes.
4. Run `npm run build`, `npm run typecheck`, `npm test`, and `npm run lint`.

## Security reports

Use [GitHub Security Advisories](https://github.com/mAsyamJ/spendrail/security/advisories).
Do not file public issues for vulnerabilities.

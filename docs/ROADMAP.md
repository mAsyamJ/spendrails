# Roadmap

SpendRail’s core primitive is programmable spending authority for agents.
Applications such as company expense tools or marketplaces are out of scope
until that primitive is solid.

## Now

- Deterministic ALLOW / ASK / BLOCK policy engine
- Wallet adapters behind policy
- x402 hooks and circuit breaker
- MCP server and sandbox rails
- Spend tracking, alerts, provenance

## Next

- Hardened testnet wallet adapters
- Richer approval channels for ASK
- Stronger recipient and purpose allowlists for production policies
- Dashboard auth defaults that bind to loopback unless explicitly configured
- Recurring mandate UX on top of existing `@spendrail/a2a` primitives

## Later

- Additional payment rails behind the same policy engine
- Hosted control plane (optional; not required to use the SDK)

This file is intent, not a promise of dates or production certification.

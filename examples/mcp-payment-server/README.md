# SpendRail MCP payment example

Reference MCP server that sends every `pay` call through SpendRail:

```
Agent
    ↓
SpendRail MCP
    ↓
PolicyEngine
    ↓
ALLOW / ASK / BLOCK
    ↓
sandbox wallet
```

Prefer the published CLI for most setups:

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

This example is the in-repo source equivalent.

```bash
npx tsx src/index.ts
```

```json
{
  "mcpServers": {
    "spendrail": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/examples/mcp-payment-server/src/index.ts"],
      "env": {
        "SPENDRAIL_MAX_DAILY": "5",
        "SPENDRAIL_MAX_PER_TX": "2",
        "SPENDRAIL_APPROVAL_ABOVE": "1",
        "SPENDRAIL_INITIAL_BALANCE": "5"
      }
    }
  }
}
```

## Tools

- `pay` — submit a payment intent
- `check_balance` — wallet and budget utilization
- `payment_history` — audit trail

See [docs/MCP_INTEGRATION.md](../../docs/MCP_INTEGRATION.md) and
[docs/HERMES_DEMO.md](../../docs/HERMES_DEMO.md).

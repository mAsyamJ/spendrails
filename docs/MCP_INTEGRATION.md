# MCP integration

SpendRail exposes payment tools over the Model Context Protocol so an agent can
request spend without holding wallet keys.

## Run

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

## Tools

| Tool | Purpose |
| --- | --- |
| `pay` | Submit a payment intent for policy evaluation and (on ALLOW) sandbox execution |
| `check_balance` | Wallet state and budget utilization |
| `payment_history` | Audit trail |
| `discover_capabilities` | Server limits and available tools |
| `manage_policy` | Inspect or update loaded policies |
| `evaluate_payment` | Dry-run policy evaluation without executing |
| `file_dispute` / `list_disputes` | Dispute workflow |
| `get_audit_trail` | Provenance records |
| `get_alerts` | Spend alerts |

## Environment

| Variable | Meaning |
| --- | --- |
| `SPENDRAIL_MAX_PER_TX` | Per-transaction limit |
| `SPENDRAIL_MAX_DAILY` | Daily budget |
| `SPENDRAIL_MAX_HOURLY` | Hourly budget |
| `SPENDRAIL_APPROVAL_ABOVE` | ASK threshold |
| `SPENDRAIL_INITIAL_BALANCE` | Sandbox starting balance |
| `SPENDRAIL_CURRENCY` | Currency code |

The MCP server bundles `SpendRailStack`: policy engine, tracker, alerts,
sandbox rail, provenance, and disputes. The default numeric limits are
conservative starting values; the Hermes demo overrides them to a $5 daily
budget. See [HERMES_DEMO.md](HERMES_DEMO.md).

## Programmatic use

```typescript
import { createSpendRailMcpServer } from '@spendrail/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const { server } = createSpendRailMcpServer();
await server.connect(new StdioServerTransport());
```

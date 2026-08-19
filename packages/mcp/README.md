# @spendrail/mcp

MCP server for SpendRail. Agents request payments; the policy engine returns
ALLOW / ASK / BLOCK. The agent does not hold wallet keys.

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

```typescript
import { createSpendRailMcpServer } from '@spendrail/mcp';
```

See [docs/MCP_INTEGRATION.md](../../docs/MCP_INTEGRATION.md).

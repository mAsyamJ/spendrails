# Hermes demo

Target: a Hermes agent on a VPS, with SpendRail as the financial permission layer
and a sandbox/testnet wallet.

**The AI is not the security boundary.**

```
User
    ↓
Hermes
    ↓
SpendRail MCP
    ↓
PolicyEngine
    ↓
ALLOW / ASK / BLOCK
    ↓
sandbox/testnet wallet
    ↓
transaction result
    ↓
SpendRail monitor
```

## Demo policy

| Control | Value |
| --- | --- |
| Daily budget | $5 |
| ALLOW | under $1 |
| ASK | $1–$2 |
| BLOCK | above $2 |
| Allowed services | Research API, Firecrawl, OpenAI |
| Unknown recipients | BLOCK |

Example MCP config:

```json
{
  "mcpServers": {
    "spendrail": {
      "command": "npx",
      "args": ["spendrail-mcp"],
      "env": {
        "SPENDRAIL_MAX_DAILY": "5",
        "SPENDRAIL_MAX_PER_TX": "2",
        "SPENDRAIL_APPROVAL_ABOVE": "1",
        "SPENDRAIL_INITIAL_BALANCE": "5",
        "SPENDRAIL_CURRENCY": "USD"
      }
    }
  }
}
```

## Demo events

1. Research API — $0.20 — **ALLOW**
2. Premium Dataset — $1.50 — **ASK**
3. Unknown API — $20 — **BLOCK**
4. Rapid retry / payment storm — **CIRCUIT BREAKER**
5. Prompt injection tries to spend $50 — **BLOCK**

Local CLI equivalent:

```bash
npx spendrail-demo
```

Hermes may argue for the $20 unknown charge or the injected $50 transfer.
SpendRail still BLOCKS. The model never signs, never holds keys, and never
overrides the policy engine.

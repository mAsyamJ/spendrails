# Policy engine

`PolicyEngine` is deterministic spending authority. No LLM participates in the
decision.

## Evaluation order

1. Windowed budgets (hourly / daily / weekly / monthly)
2. Cooldown
3. Rules by priority (first match wins)
4. Across loaded policies, the most restrictive action wins:
   `deny` > `require_approval` > `flag` > `allow`

Product language maps those actions to **BLOCK / ASK / FLAG / ALLOW**.

## Typical rules

| Helper | Use |
| --- | --- |
| `blockAbove(amount, currency)` | Hard BLOCK above a per-transaction cap |
| `requireApprovalAbove(amount, currency)` | ASK above an approval threshold |
| `allowOnlyRecipients(...)` | Approved-recipient allowlist |
| `blockRecipient(pattern)` | Deny a vendor pattern |
| `denyAll()` | Catch-all BLOCK |
| `allowAll()` | Catch-all ALLOW |

## Demo policy

Daily budget $5. ALLOW under $1. ASK $1–$2. BLOCK above $2.

```typescript
engine.loadPolicy({
  id: 'demo',
  name: 'Demo spending authority',
  enabled: true,
  rules: [
    blockAbove(2, 'USD'),
    requireApprovalAbove(1, 'USD'),
    allowOnlyRecipients('research-api.example', 'firecrawl.example', 'api.openai.com'),
    denyAll(),
  ],
  budgets: [{ window: 'daily', maxAmount: 5, currency: 'USD' }],
});
```

Call `recordTransaction` only after an ALLOW is executed so budget buckets
reflect real spend, not blocked intents.

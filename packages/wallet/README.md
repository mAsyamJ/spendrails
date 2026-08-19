# @spendrail/wallet

Wallet-agnostic adapter layer. Plug a signing backend behind SpendRail
policy so the agent never becomes the financial authority.

```typescript
import { createWallet, SpendRailWallet } from '@spendrail/wallet';

const wallet = createWallet({
  limits: { perTx: 2, daily: 5, approvalAbove: 1 },
});
```

`SpendRailWallet` evaluates the payment intent first. BLOCK never reaches the
adapter. ASK requires an approval handler. ALLOW may call `signAndSend`.

# @spendrail/protect

Dispute resolution, provenance tracking, and recovery for AI agent payments. Know exactly what happened, prove it, and get your money back.

Part of [SpendRail](https://github.com/mAsyamJ/spendrail).

## Install

```bash
npm install @spendrail/protect @spendrail/core
```

## Quick Start

```typescript
import { TransactionProvenance, DisputeManager, RecoveryEngine } from '@spendrail/protect';

const provenance = new TransactionProvenance();
const disputes = new DisputeManager({ provenance });

// Record provenance chain: intent -> policy -> execution -> settlement
provenance.recordIntent(tx, { originalPrompt: 'Buy market data' });
provenance.recordPolicyCheck(tx.id, 'pass', { policyId: 'production' });
provenance.recordExecution(tx.id, 'pass', { txHash: '0xabc...' });
provenance.recordSettlement(tx.id, 'fail', { error: 'Service returned 500' });

// File dispute with automatic evidence
const dispute = disputes.file({
  transactionId: tx.id,
  agentId: tx.agentId,
  reason: 'Service failed to deliver after payment',
  requestedAmount: tx.amount,
});

// Resolve
disputes.resolve(dispute.id, {
  status: 'resolved_refunded',
  liability: 'service_provider',
  resolvedAmount: tx.amount,
});
```

## Features

- **TransactionProvenance** — Immutable chain: intent -> policy -> approval -> execution -> settlement
- **DisputeManager** — File, track, and resolve disputes with auto-attached evidence
- **RecoveryEngine** — Automated recovery workflows for failed transactions
- **EU AI Act ready** — Full audit trails for autonomous financial decisions

## License

MIT

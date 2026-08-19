// =============================================================================
// @spendrail/wallet — Public API
// Wallet-agnostic adapter layer for SpendRail.
// Plug any wallet backend behind SpendRail policy controls.
// =============================================================================

// ✨ Quick start (recommended)
export { createWallet } from './factory.js';
export type { CreateWalletOptions } from './factory.js';
export { presets } from './presets.js';
export type { SpendLimits } from './presets.js';

// Orchestrator
export { SpendRailWallet } from './spendrail-wallet.js';

// Adapters
export { CoinbaseAdapter } from './coinbase-adapter.js';
export { LocalSignerAdapter } from './local-signer-adapter.js';

// Types
export type {
  // Core interface
  WalletAdapter,
  WalletBalance,
  TransactionReceipt,
  TransactionStatus,

  // Orchestrator config
  SpendRailWalletConfig,
  PaymentRequest,
  PaymentResult,

  // Adapter configs
  CoinbaseAdapterConfig,
  LocalSignerAdapterConfig,
} from './types.js';

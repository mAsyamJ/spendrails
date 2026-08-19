// =============================================================================
// Shared Utilities
// =============================================================================

import { randomBytes } from 'crypto';
import type { TransactionId, DisputeId } from './types.js';

/**
 * Generate a unique identifier with the given prefix.
 * Format: <prefix>_<hex_timestamp>_<random>
 *
 * @param prefix - Short string prefix (e.g., 'sr', 'dsp')
 * @returns A unique string identifier
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(16);
  const random = randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a unique transaction ID.
 * Format: sr_<hex_timestamp>_<random>
 */
export function generateTransactionId(): TransactionId {
  return generateId('sr') as TransactionId;
}

/**
 * Generate a unique dispute ID.
 * Format: dsp_<hex_timestamp>_<random>
 */
export function generateDisputeId(): DisputeId {
  return generateId('dsp') as DisputeId;
}

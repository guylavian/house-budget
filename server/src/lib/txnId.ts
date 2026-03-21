import { createHash } from 'crypto';

/**
 * Generates a deterministic 40-char hex ID from transaction content.
 * Same inputs always produce the same ID — safe to call multiple times.
 */
export function generateTxnId(txn: {
  source: string;
  date: Date | string;
  description: string;
  chargedAmount: number;
}): string {
  const dateStr = typeof txn.date === 'string'
    ? txn.date.slice(0, 10)
    : txn.date.toISOString().slice(0, 10);

  const raw = [
    txn.source.trim().toLowerCase(),
    dateStr,
    txn.description.trim().toLowerCase().replace(/\s+/g, ' '),
    Math.abs(txn.chargedAmount).toFixed(2),
  ].join('|');

  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

import { PrismaClient } from '@prisma/client';
import { parseBankExcel, ParsedTransaction } from './bankParserService';
import { classificationService } from './classificationService';
import { generateTxnId } from '../lib/txnId';

export interface ScrapeResult {
  batchId:      string;
  source:       string;
  imported:     number;
  duplicates:   number;
  unclassified: number;
  errors:       string[];
}

// Shape coming from @sergienko4/israeli-bank-scrapers
interface ScraperTransaction {
  type:             'normal' | 'installments';
  date:             string;
  originalAmount:   number;
  originalCurrency: string;
  chargedAmount:    number;
  description:      string;
  memo?:            string;
  installments?:    { number: number; total: number };
  status:           'completed' | 'pending';
}

export interface ImportResult {
  batchId: string;
  imported: number;
  skipped: number;
  duplicates: number;
  unclassified: number;
  errors: { row: number; message: string }[];
}

function getMonthYear(transactions: ParsedTransaction[]): { month: number; year: number } {
  if (!transactions.length) return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
  const dates = transactions.map(t => t.date);
  const counts: Record<string, number> = {};
  for (const d of dates) {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const [year, month] = dominant.split('-').map(Number);
  return { month, year };
}

export async function importFromExcel(buffer: Buffer, prisma: PrismaClient, filename?: string): Promise<ImportResult> {
  const errors: { row: number; message: string }[] = [];
  let parsed: ParsedTransaction[] = [];

  try {
    parsed = await parseBankExcel(buffer, filename);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { batchId: '', imported: 0, skipped: 0, duplicates: 0, unclassified: 0, errors: [{ row: 0, message: msg }] };
  }

  return processTransactions(parsed, 'excel', prisma, errors);
}

async function processTransactions(
  parsed: ParsedTransaction[],
  fileType: 'excel' | 'scraper',
  prisma: PrismaClient,
  errors: { row: number; message: string }[]
): Promise<ImportResult> {
  const source = parsed[0]?.source ?? 'unknown';
  const { month, year } = getMonthYear(parsed);
  const batchId = `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let unclassified = 0;

  // Fetch the 'אשראי' category ID once for credit card payment rows (falls back to 'העברה')
  const { Category } = await import('../models/Category');
  const creditCat = await Category.findOne({ name: 'אשראי' });
  const transferCat = creditCat ?? await Category.findOne({ name: 'העברה' });
  const transferCategoryId = transferCat?._id.toString() ?? null;

  const rows = parsed.map((t, i) => {
    try {
      const isCCPayment = t.typeHint === 'credit_card_payment';

      if (isCCPayment) {
        // Credit card payment rows are always 'transfer' — no classification needed
        return {
          id: generateTxnId({ source: t.source, date: t.date, description: t.description, chargedAmount: t.chargedAmount }),
          source: t.source,
          sourceType: t.sourceType,
          date: t.date,
          description: t.description,
          chargedAmount: t.chargedAmount,
          originalAmount: t.originalAmount ?? null,
          type: 'transfer' as const,
          categoryId: transferCategoryId,
          confidence: 'auto' as const,
          isRecurring: false,
          memo: t.memo ?? null,
          cardLast4: t.cardLast4 ?? null,
          importBatchId: batchId,
        };
      }

      const classification = classificationService.classify(t.description);
      if (classification.confidence === 'manual') unclassified++;
      // classification type wins over bank type hint
      const type = classification.confidence === 'auto' ? classification.type : t.typeHint;
      return {
        id: generateTxnId({ source: t.source, date: t.date, description: t.description, chargedAmount: t.chargedAmount }),
        source: t.source,
        sourceType: t.sourceType,
        date: t.date,
        description: t.description,
        chargedAmount: t.chargedAmount,
        originalAmount: t.originalAmount ?? null,
        type,
        categoryId: classification.categoryId || null,
        confidence: classification.confidence,
        isRecurring: t.isRecurring,
        memo: t.memo ?? null,
        cardLast4: t.cardLast4 ?? null,
        importBatchId: batchId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ row: i + 1, message: msg });
      return null;
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const before = await prisma.bankTransaction.count({ where: { importBatchId: batchId } });
  await prisma.bankTransaction.createMany({ data: rows, skipDuplicates: true });
  const after = await prisma.bankTransaction.count({ where: { importBatchId: batchId } });

  const imported = after - before;
  const duplicates = rows.length - imported;

  // Backfill cardLast4 for any pre-existing rows that were skipped as duplicates but have no cardLast4
  const rowsWithCard = rows.filter(r => r.cardLast4);
  if (rowsWithCard.length > 0 && duplicates > 0) {
    for (const r of rowsWithCard) {
      await prisma.bankTransaction.updateMany({
        where: { id: r.id, cardLast4: null },
        data: { cardLast4: r.cardLast4 },
      });
    }
  }

  await prisma.importBatch.create({
    data: {
      id: batchId,
      source,
      month,
      year,
      fileType,
      rowsTotal: parsed.length,
      rowsImported: imported,
      rowsSkipped: errors.length,
    },
  });

  return { batchId, imported, skipped: errors.length, duplicates, unclassified, errors };
}

// ─── Scraper import ───────────────────────────────────────────────────────────
// Converts transactions from @sergienko4/israeli-bank-scrapers into ParsedTransaction
// format and runs the same classification + dedup pipeline as Excel imports.

export async function processScraperTransactions(
  txns: ScraperTransaction[],
  source: string,
  prismaClient: PrismaClient,
): Promise<ScrapeResult> {
  const sourceType: 'checking' | 'credit' = source === 'otsar_hahayal' ? 'checking' : 'credit';

  const parsed: ParsedTransaction[] = txns
    .filter(txn => Math.abs(txn.chargedAmount) > 0 && txn.status === 'completed')
    .map(txn => {
      const isPositive = txn.chargedAmount > 0;
      const amount     = Math.abs(txn.chargedAmount);
      // Checking account: positive = income (credit to account), negative = expense
      // Credit card:      always expense (charged to card = debit from perspective)
      const typeHint: 'income' | 'expense' =
        sourceType === 'checking' ? (isPositive ? 'income' : 'expense') : 'expense';

      const memoBase    = txn.memo ?? '';
      const installMemo = txn.installments
        ? `תשלום ${txn.installments.number} מתוך ${txn.installments.total}`
        : '';
      const memo = [memoBase, installMemo].filter(Boolean).join(' | ') || undefined;

      return {
        source,
        sourceType,
        date:           new Date(txn.date),
        description:    txn.description,
        chargedAmount:  amount,
        originalAmount: txn.originalCurrency !== 'ILS' ? txn.originalAmount : undefined,
        typeHint,
        isRecurring:    txn.type === 'installments',
        memo,
      };
    });

  const result = await processTransactions(parsed, 'scraper', prismaClient, []);

  return {
    batchId:      result.batchId,
    source,
    imported:     result.imported,
    duplicates:   result.duplicates,
    unclassified: result.unclassified,
    errors:       result.errors.map(e => e.message),
  };
}

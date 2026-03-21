import * as XLSX from 'xlsx';

export interface ParsedTransaction {
  source: string;
  sourceType: 'checking' | 'credit';
  date: Date;
  description: string;
  chargedAmount: number;
  originalAmount?: number;
  memo?: string;
  isRecurring: boolean;
  typeHint: 'income' | 'expense' | 'credit_card_payment';
  cardLast4?: string;
}

export class ParseError extends Error {
  constructor(public row: number, message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

type CellValue = string | number | Date | boolean | null | undefined;

// Load buffer into a 2D array using SheetJS (supports .xls and .xlsx)
function loadSheet(buffer: Buffer): CellValue[][] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (!wb.SheetNames.length) throw new Error('No worksheet found in file');
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('No worksheet found in file');
  const rows = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  return rows as CellValue[][];
}

// Get cell as trimmed string (0-indexed col)
function cellStr(row: CellValue[], col: number): string {
  if (col < 0 || col >= row.length) return '';
  const val = row[col];
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  return String(val).trim();
}

// Find last matching column index (0-based). Returns -1 if not found.
// "Last" matches ExcelJS findCol behavior — useful when there are multiple
// similar headers (e.g. 'סכום עסקה' vs 'סכום חיוב').
function findCol(row: CellValue[], name: string): number {
  let found = -1;
  row.forEach((cell, i) => {
    if (String(cell ?? '').replace(/[\r\n]+/g, ' ').includes(name)) found = i;
  });
  return found;
}

// Find first matching column index (0-based).
function findColFirst(row: CellValue[], name: string): number {
  return row.findIndex(cell =>
    String(cell ?? '').replace(/[\r\n]+/g, ' ').includes(name)
  );
}

// Parse number from cell — preserves sign (negative = refund)
function parseAmount(val: CellValue): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[₪,\s]/g, '').trim();
  if (!str) return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Parse date from DD/MM/YYYY string or Date object
function parseDate(val: CellValue): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Parse ישראכרט date: DD.MM.YY (2-digit year) or DD.MM.YYYY
function parseDateIsracard(val: CellValue): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  // DD.MM.YY
  const short = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (short) {
    const year = 2000 + parseInt(short[3]);
    return new Date(`${year}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`);
  }
  // DD.MM.YYYY
  const long = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (long) return new Date(`${long[3]}-${long[2].padStart(2,'0')}-${long[1].padStart(2,'0')}`);
  // DD/MM/YYYY
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(`${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`);
  return null;
}

type BankFormat = 'otsar_hahayal' | 'isracard' | 'diners' | 'max' | 'unknown';

function detectFormat(rows: CellValue[][]): BankFormat {
  const allText = rows.slice(0, 10).flat().map(c => String(c ?? '').trim()).join('|');
  // מקס — 'שם בית העסק' (with ה) + 'מטבע חיוב'
  if (allText.includes('שם בית העסק') && allText.includes('מטבע חיוב')) return 'max';
  // דיינרס/כאל — 'שם בית עסק' + unique 'ענף' column
  if (allText.includes('שם בית עסק') && allText.includes('ענף')) return 'diners';
  // ישראכרט — 'שם בית עסק' + 'סכום חיוב' without 'ענף'
  if (allText.includes('שם בית עסק') && allText.includes('סכום חיוב')) return 'isracard';
  // אוצר החייל — checking with חובה/זכות
  if (allText.includes('חובה') && allText.includes('זכות') && allText.includes('תיאור')) return 'otsar_hahayal';
  return 'unknown';
}

const SKIP_KEYWORDS = ['סה"כ', 'יתרה', 'סיכום', 'total'];
function shouldSkip(desc: string): boolean {
  return SKIP_KEYWORDS.some(kw => desc.includes(kw));
}

const CREDIT_CARD_PAYMENT_KEYWORDS = [
  'ישראכרט',
  'מקס איט',
  'לאומי- מקס',
  'הרשאה דיינרס',
  'דיינרס',
  'אמריקן אקספרס',
  'american express',
];
function isCreditCardPayment(desc: string): boolean {
  const lower = desc.toLowerCase();
  return CREDIT_CARD_PAYMENT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function parseOtsarHahayal(rows: CellValue[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  let headerIdx = -1;
  let header: CellValue[] = [];

  for (let i = 0; i < rows.length; i++) {
    const strs = rows[i].map(c => String(c ?? '').trim());
    if (strs.includes('חובה') && strs.includes('זכות')) {
      header = rows[i];
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return results;

  const dateCol   = findCol(header, 'תאריך');
  const descCol   = findCol(header, 'תיאור');
  const debitCol  = findCol(header, 'חובה');
  const creditCol = findCol(header, 'זכות');

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const desc = cellStr(row, descCol);
    if (!desc) continue;

    const debitRaw  = row[debitCol];
    const creditRaw = row[creditCol];
    const debit  = debitRaw  !== null && debitRaw  !== undefined ? parseAmount(debitRaw)  : null;
    const credit = creditRaw !== null && creditRaw !== undefined ? parseAmount(creditRaw) : null;
    if (!debit && !credit) continue;

    const dateVal = row[dateCol];
    const date = dateVal instanceof Date ? dateVal : parseDate(dateVal);
    if (!date) throw new ParseError(i + 1, `Cannot parse date at row ${i + 1}`);

    const isIncome   = !!credit && !debit;
    const isCCPayment = !isIncome && isCreditCardPayment(desc);

    results.push({
      source: 'otsar_hahayal',
      sourceType: 'checking',
      date,
      description: desc,
      chargedAmount: isIncome ? Math.abs(credit ?? 0) : Math.abs(debit ?? 0),
      isRecurring: false,
      typeHint: isCCPayment ? 'credit_card_payment' : (isIncome ? 'income' : 'expense'),
    });
  }
  return results;
}

function parseIsracard(rows: CellValue[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  let headerIdx = -1;
  let header: CellValue[] = [];
  let cardLast4 = '';

  for (let i = 0; i < rows.length; i++) {
    const firstCell = String(rows[i][0] ?? '');
    const cardMatch = firstCell.match(/[-–]\s*(\d{4})\s*$/);
    if (cardMatch && !cardLast4) cardLast4 = cardMatch[1];

    const strs = rows[i].map(c => String(c ?? '').trim());
    if (strs.some(s => s.includes('שם בית עסק')) && strs.some(s => s.includes('סכום חיוב'))) {
      header    = rows[i];
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return results;

  const dateCol   = findColFirst(header, 'תאריך');
  const descCol   = findCol(header, 'שם בית עסק');
  const amountCol = findCol(header, 'סכום חיוב');
  const memoCol   = findCol(header, 'פירוט נוסף');

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row  = rows[i];
    const desc = cellStr(row, descCol);
    if (!desc || desc.length > 100 || shouldSkip(desc)) continue;

    const rawAmount = row[amountCol];
    if (rawAmount === null || rawAmount === undefined) continue;
    const numAmount = parseAmount(rawAmount);
    if (numAmount === null || numAmount === 0) continue;

    const dateVal = row[dateCol];
    const date = dateVal instanceof Date ? dateVal : parseDateIsracard(dateVal);
    if (!date) continue;

    const memo = memoCol >= 0 ? cellStr(row, memoCol) : '';
    results.push({
      source: 'isracard',
      sourceType: 'credit',
      date,
      description: desc,
      chargedAmount: Math.abs(numAmount),
      isRecurring: false,
      typeHint: numAmount < 0 ? 'income' : 'expense',
      memo: memo || undefined,
      cardLast4: cardLast4 || undefined,
    });
  }
  return results;
}

function parseDiners(rows: CellValue[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  let headerIdx = -1;
  let header: CellValue[] = [];
  let cardLast4 = '';

  for (let i = 0; i < rows.length; i++) {
    const firstCell = String(rows[i][0] ?? '');
    const cardMatch = firstCell.match(/המסתיים ב-(\d{4})/);
    if (cardMatch && !cardLast4) cardLast4 = cardMatch[1];

    const strs = rows[i].map(c => String(c ?? '').replace(/\n/g, ' ').trim());
    if (strs.some(s => s.includes('שם בית עסק')) && strs.some(s => s.includes('ענף'))) {
      header    = rows[i];
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return results;

  const dateCol   = findColFirst(header, 'תאריך');
  const descCol   = findCol(header, 'שם בית עסק');
  const amountCol = findCol(header, 'סכום חיוב');
  const rawAmtCol = findColFirst(header, 'סכום עסקה');
  const typeCol   = findCol(header, 'סוג');
  const branchCol = findCol(header, 'ענף');
  const notesCol  = findCol(header, 'הערות');

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row  = rows[i];
    const desc = cellStr(row, descCol);
    if (!desc || desc.length > 100 || shouldSkip(desc)) continue;

    // Prefer 'סכום חיוב', fall back to 'סכום עסקה' for pending rows
    const chargedRaw = (row[amountCol] !== null && row[amountCol] !== undefined)
      ? row[amountCol]
      : row[rawAmtCol];
    if (chargedRaw === null || chargedRaw === undefined) continue;
    const numAmount = parseAmount(chargedRaw);
    if (numAmount === null || numAmount === 0) continue;

    const dateVal = row[dateCol];
    const date = dateVal instanceof Date ? dateVal : parseDateIsracard(dateVal);
    if (!date) continue;

    const txType    = cellStr(row, typeCol);
    const branch    = branchCol >= 0 ? cellStr(row, branchCol) : '';
    const notes     = notesCol  >= 0 ? cellStr(row, notesCol)  : '';
    const isPending = notes.includes('קליטה');
    const isRefund  = numAmount < 0 || txType.includes('זיכוי');

    const memoParts = [branch, isPending ? 'ממתין לחיוב' : ''].filter(Boolean);
    results.push({
      source: 'diners',
      sourceType: 'credit',
      date,
      description: desc,
      chargedAmount: Math.abs(numAmount),
      isRecurring: false,
      typeHint: isRefund ? 'income' : 'expense',
      memo: memoParts.join(' | ') || undefined,
      cardLast4: cardLast4 || undefined,
    });
  }
  return results;
}

// Parse DD-MM-YYYY (Max export format)
function parseMaxDate(val: CellValue): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) return new Date(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`);
  return null;
}

function extractCardFromFilename(filename: string): string | undefined {
  const matches = filename.match(/\b(\d{4})\b/g);
  return matches?.find(m => {
    const n = parseInt(m);
    return n < 2000 || n > 2100; // exclude years like 2026
  });
}

function parseMax(rows: CellValue[][], filename?: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  let headerIdx = -1;
  let header: CellValue[] = [];

  for (let i = 0; i < rows.length; i++) {
    const strs = rows[i].map(c => String(c ?? '').replace(/[\r\n]+/g, ' ').trim());
    if (strs.some(s => s.includes('שם בית העסק')) && strs.some(s => s.includes('סכום חיוב'))) {
      header    = rows[i];
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return results;

  const dateCol    = findColFirst(header, 'תאריך עסקה');
  const descCol    = findCol(header, 'שם בית העסק');
  const amountCol  = findCol(header, 'סכום חיוב');
  const origAmtCol = findCol(header, 'סכום עסקה מקורי');
  const origCurCol = findCol(header, 'מטבע עסקה מקורי');
  const notesCol   = findCol(header, 'הערות');
  const cardCol    = findCol(header, '4 ספרות');
  const txTypeCol  = findCol(header, 'סוג עסקה');

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row  = rows[i];
    const desc = cellStr(row, descCol);
    if (!desc || desc.length > 100 || shouldSkip(desc)) continue;

    const rawAmount = row[amountCol];
    if (rawAmount === null || rawAmount === undefined) continue;
    const numAmount = parseAmount(rawAmount);
    if (numAmount === null || numAmount === 0) continue;

    const date = parseMaxDate(row[dateCol]);
    if (!date) continue;

    const notes    = notesCol   >= 0 ? cellStr(row, notesCol)   : '';
    const cardLast4 = cardCol   >= 0 ? cellStr(row, cardCol)    : '';
    const txType   = txTypeCol  >= 0 ? cellStr(row, txTypeCol)  : '';
    const origAmt  = origAmtCol >= 0 ? parseAmount(row[origAmtCol]) : null;
    const origCur  = origCurCol >= 0 ? cellStr(row, origCurCol) : '₪';

    const isInstallment = txType.includes('חלוקת') || notes.includes('מתוך');
    const isRefund      = numAmount < 0 || txType.includes('זיכוי');

    results.push({
      source:         'max',
      sourceType:     'credit',
      date,
      description:    desc,
      chargedAmount:  Math.abs(numAmount),
      originalAmount: (origAmt !== null && origCur !== '₪') ? origAmt : undefined,
      isRecurring:    isInstallment,
      typeHint:       isRefund ? 'income' : 'expense',
      memo:           notes || undefined,
      cardLast4:      cardLast4 || undefined,
    });
  }

  // If no cardLast4 found in any row column, try to extract from filename
  const allMissingCard = results.every(r => !r.cardLast4);
  if (allMissingCard && filename) {
    const cardFromFilename = extractCardFromFilename(filename);
    if (cardFromFilename) {
      results.forEach(r => { r.cardLast4 = cardFromFilename; });
    }
  }

  return results;
}

export async function parseBankExcel(buffer: Buffer, filename?: string): Promise<ParsedTransaction[]> {
  const rows = loadSheet(buffer);
  if (!rows.length) throw new Error('No worksheet found in file');

  const format = detectFormat(rows);
  switch (format) {
    case 'otsar_hahayal': return parseOtsarHahayal(rows);
    case 'isracard':      return parseIsracard(rows);
    case 'diners':        return parseDiners(rows);
    case 'max':           return parseMax(rows, filename);
    default: throw new Error(
      'פורמט לא מזוהה. קבצים נתמכים: אוצר החייל (עו"ש), ישראכרט, דיינרס/כאל, מקס'
    );
  }
}

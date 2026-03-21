import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { importFromExcel } from '../services/importService';
import { generateSnapshot } from '../services/snapshotService';
import { classificationService } from '../services/classificationService';
import { AppSettings } from '../models/AppSettings';
import { Category } from '../models/Category';
import { CardOwner } from '../models/CardOwner';
import { ScraperConfig } from '../models/ScraperConfig';
import { CategoryRule } from '../models/CategoryRule';
import type { BankTransactionQueryParams, BulkReclassifyBody } from '../interfaces/bank';
import { aiClassificationService } from '../services/aiClassificationService';

const router = Router();

// Multer — memory storage (no disk writes)
const upload = multer({ storage: multer.memoryStorage() });

// ─── POST /api/bank/import/excel/bulk ────────────────────────────────────────
// Must be registered BEFORE /import/excel to avoid path prefix shadowing
router.post(
  '/import/excel/bulk',
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded. Use multipart field name "files".' });
        return;
      }

      const results = await Promise.allSettled(
        files.map(async (file) => {
          const result = await importFromExcel(file.buffer, prisma, file.originalname);
          return { filename: file.originalname, ...result };
        })
      );

      const response = results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return {
            filename: files[i].originalname,
            batchId:  '',
            imported: 0,
            skipped:  0,
            duplicates: 0,
            unclassified: 0,
            errors: [{ row: 0, message: r.reason?.message ?? 'שגיאה לא ידועה' }],
          };
        }
      });

      const totalImported = response.reduce((s, r) => s + r.imported, 0);
      const totalUnclassified = response.reduce((s, r) => s + r.unclassified, 0);

      res.status(200).json({ files: response, totalImported, totalUnclassified });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/bank/import/excel ──────────────────────────────────────────────
router.post(
  '/import/excel',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded. Use multipart field name "file".' });
        return;
      }
      const result = await importFromExcel(req.file.buffer, prisma, req.file.originalname);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/bank/import/scrape ─────────────────────────────────────────────
// Body: { source, credentials: { [field]: string }, monthsBack? }
// SECURITY: credentials are NEVER stored — used once and discarded
router.post('/import/scrape', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, credentials, monthsBack = 1 } = req.body as {
      source: string;
      credentials: Record<string, string>;
      monthsBack?: number;
    };

    if (!source || !credentials) {
      res.status(400).json({ error: 'source and credentials are required' });
      return;
    }

    const config = await ScraperConfig.findOne({ source, isEnabled: true });
    if (!config) {
      res.status(404).json({ error: `מקור '${source}' לא נמצא או מושבת` });
      return;
    }

    const missingFields = config.credentialFields.filter(f => !credentials[f]);
    if (missingFields.length > 0) {
      res.status(400).json({ error: `שדות חסרים: ${missingFields.join(', ')}` });
      return;
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const { scrapeSource } = await import('../services/scraperService');
    const result = await scrapeSource(source, credentials, startDate); // DO NOT LOG credentials

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('INVALID_PASSWORD') || message.includes('invalidPassword')) {
      res.status(401).json({ error: 'שם משתמש או סיסמה שגויים', errorType: 'INVALID_PASSWORD' });
    } else if (message.includes('TIMEOUT') || message.includes('timeout')) {
      res.status(408).json({ error: 'פג זמן ההתחברות לאתר הבנק', errorType: 'TIMEOUT' });
    } else if (message.includes('TWO_FACTOR') || message.includes('OTP')) {
      res.status(403).json({ error: 'נדרש קוד אימות (OTP)', errorType: 'OTP_REQUIRED' });
    } else {
      next(err);
    }
  }
});

// ─── GET /api/bank/scraper-configs ────────────────────────────────────────────
router.get('/scraper-configs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await ScraperConfig.find({}).select('-__v');
    res.json(configs);
  } catch (err) { next(err); }
});

// ─── PATCH /api/bank/scraper-configs/:source ──────────────────────────────────
router.patch('/scraper-configs/:source', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isEnabled, autoScrapeEnabled } = req.body as {
      isEnabled?: boolean;
      autoScrapeEnabled?: boolean;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    if (isEnabled          !== undefined) update.isEnabled          = isEnabled;
    if (autoScrapeEnabled  !== undefined) update.autoScrapeEnabled  = autoScrapeEnabled;

    const config = await ScraperConfig.findOneAndUpdate(
      { source: req.params.source },
      { $set: update },
      { new: true }
    );
    if (!config) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(config);
  } catch (err) { next(err); }
});

// ─── GET /api/bank/snapshot ───────────────────────────────────────────────────
router.get('/snapshot', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    let settings = await AppSettings.findOne({});
    if (!settings) settings = await AppSettings.create({});

    const snapshot = await generateSnapshot(month, year, prisma, settings);
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bank/classify/ai/batch ────────────────────────────────────────
// Must be before /classify/ai to avoid prefix shadowing
router.post('/classify/ai/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, month, year } = req.body as { ids?: string[]; month?: number; year?: number };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txns: any[];
    if (ids && ids.length > 0) {
      txns = await prisma.bankTransaction.findMany({ where: { id: { in: ids } } });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = { categoryId: null };
      if (month && year) {
        where.date = {
          gte: new Date(Number(year), Number(month) - 1, 1),
          lte: new Date(Number(year), Number(month), 0, 23, 59, 59, 999),
        };
      }
      txns = await prisma.bankTransaction.findMany({ where });
    }

    const batchResults = await aiClassificationService.classifyBatch(
      txns.map((t) => ({ id: t.id, description: t.description, chargedAmount: Number(t.chargedAmount) }))
    );

    let updated = 0;
    for (const r of batchResults) {
      if (r.suggestion) {
        await prisma.bankTransaction.update({
          where: { id: r.id },
          data: { categoryId: r.suggestion.categoryId, type: r.suggestion.type, confidence: 'ai_suggested' },
        });
        updated++;
      }
    }

    res.json({ total: txns.length, updated });
  } catch (err) { next(err); }
});

// ─── POST /api/bank/classify/ai/approve-all ──────────────────────────────────
router.post('/classify/ai/approve-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.body as { month?: number; year?: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { confidence: 'ai_suggested' };
    if (month && year) {
      where.date = {
        gte: new Date(Number(year), Number(month) - 1, 1),
        lte: new Date(Number(year), Number(month), 0, 23, 59, 59, 999),
      };
    }
    const result = await prisma.bankTransaction.updateMany({ where, data: { confidence: 'manual' } });
    res.json({ approved: result.count });
  } catch (err) { next(err); }
});

// ─── POST /api/bank/classify/ai ──────────────────────────────────────────────
router.post('/classify/ai', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body as { id: string };
    const txn = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!txn) { res.status(404).json({ error: 'Not found' }); return; }

    const suggestion = await aiClassificationService.classify(txn.description, Number(txn.chargedAmount));
    if (!suggestion) {
      res.json({ updated: false, reason: 'no_suggestion' });
      return;
    }

    await prisma.bankTransaction.update({
      where: { id },
      data: { categoryId: suggestion.categoryId, type: suggestion.type, confidence: 'ai_suggested' },
    });
    res.json({ updated: true, suggestion });
  } catch (err) { next(err); }
});

// ─── GET /api/bank/transactions ───────────────────────────────────────────────
router.get(
  '/transactions',
  async (req: Request<object, object, object, BankTransactionQueryParams>, res: Response, next: NextFunction) => {
    try {
      const { month, year, source, type, unclassified } = req.query;

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {};

      if (source) where.source = source;
      if (type)   where.type   = type;

      if (unclassified === 'true') {
        where.categoryId = null;
      }

      if (month && year) {
        const m = Number(month);
        const y = Number(year);
        where.date = {
          gte: new Date(y, m - 1, 1),
          lte: new Date(y, m, 0, 23, 59, 59, 999),
        };
      } else if (year) {
        const y = Number(year);
        where.date = {
          gte: new Date(y, 0, 1),
          lte: new Date(y, 11, 31, 23, 59, 59, 999),
        };
      }

      const [transactions, total] = await Promise.all([
        prisma.bankTransaction.findMany({
          where,
          orderBy: { date: 'desc' },
        }),
        prisma.bankTransaction.count({ where }),
      ]);

      // Enrich with category metadata from MongoDB
      const catIds = [...new Set(transactions.map(t => t.categoryId).filter(Boolean))];
      const categories = await Category.find({ _id: { $in: catIds } });
      const catMap = new Map(categories.map(c => [c._id.toString(), c]));

      const enriched = transactions.map(t => ({
        ...t,
        categoryName:  t.categoryId ? (catMap.get(t.categoryId)?.name  ?? null) : null,
        categoryIcon:  t.categoryId ? (catMap.get(t.categoryId)?.icon  ?? null) : null,
        categoryColor: t.categoryId ? (catMap.get(t.categoryId)?.color ?? null) : null,
      }));

      // Enrich with card owner names
      const allOwners = await CardOwner.find({});
      const ownerMap = new Map(allOwners.map(o => [`${o.source}:${o.cardLast4}`, o.ownerName]));

      const enrichedWithOwner = enriched.map(t => ({
        ...t,
        ownerName: t.cardLast4 ? (ownerMap.get(`${t.source}:${t.cardLast4}`) ?? null) : null,
      }));

      res.json({ transactions: enrichedWithOwner, total });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/bank/transactions/bulk ───────────────────────────────────────
// Must be defined BEFORE /transactions/:id to avoid route conflict
router.patch('/transactions/bulk', async (req: Request<object, object, BulkReclassifyBody>, res: Response, next: NextFunction) => {
  try {
    const { ids, categoryId, type, reclassifyAll, month, year } = req.body;

    if (reclassifyAll) {
      // Always reload rules before reclassifying
      await classificationService.reloadRules();

      // Build optional date filter
      let dateFilter: { gte: Date; lte: Date } | undefined;
      if (month && year) {
        const m = Number(month);
        const y = Number(year);
        dateFilter = {
          gte: new Date(y, m - 1, 1),
          lte: new Date(y, m, 0, 23, 59, 59, 999),
        };
      }

      const manualTxns = await prisma.bankTransaction.findMany({
        where: {
          confidence: 'manual',
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      });

      let updated = 0;
      for (const txn of manualTxns) {
        const result = classificationService.classify(txn.description);
        if (result.confidence === 'auto') {
          await prisma.bankTransaction.update({
            where: { id: txn.id },
            data: { categoryId: result.categoryId, type: result.type, confidence: 'auto' },
          });
          updated++;
        }
      }

      res.json({ updated, total: manualTxns.length });
      return;
    }

    if (!ids || !ids.length) {
      res.status(400).json({ error: 'ids array required when not using reclassifyAll' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (type       !== undefined) data.type       = type;
    if (categoryId || type) data.confidence = 'manual';

    const result = await prisma.bankTransaction.updateMany({
      where: { id: { in: ids } },
      data,
    });

    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/bank/transactions/:id ────────────────────────────────────────
router.patch('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { categoryId, type, learnRule = true, reset = false } = req.body as {
      categoryId?: string;
      type?:       string;
      learnRule?:  boolean;
      reset?:      boolean;
    };

    // Fetch current transaction (needed for description + reset path)
    const txn = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!txn) { res.status(404).json({ error: 'Not found' }); return; }

    // ── Reset to auto-classification ──────────────────────────────────────────
    if (reset) {
      const classification = classificationService.classify(txn.description);
      const updated = await prisma.bankTransaction.update({
        where: { id },
        data: {
          categoryId:  classification.categoryId || null,
          type:        classification.type,
          confidence:  classification.confidence,
        },
      });
      res.json(updated);
      return;
    }

    // ── Manual update ─────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { confidence: 'manual' };
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (type       !== undefined) data.type       = type;

    const updated = await prisma.bankTransaction.update({ where: { id }, data });

    // ── Upsert learned rule so future transactions match correctly ─────────────
    if (learnRule && categoryId && type) {
      // Use first significant word from description as the keyword
      const keyword = txn.description.trim().split(/\s+/)[0];
      if (keyword) {
        const existingForKeyword = await CategoryRule.findOne({
          keywords: keyword,
          source:   'learned',
        });

        if (existingForKeyword) {
          await CategoryRule.findByIdAndUpdate(existingForKeyword._id, { categoryId, type });
        } else {
          await CategoryRule.create({
            keywords:   [keyword],
            categoryId,
            type,
            priority:   75,
            isActive:   true,
            source:     'learned',
          });
        }

        await classificationService.reloadRules();
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/bank/by-owner ───────────────────────────────────────────────────
router.get('/by-owner', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    const where = {
      type: 'expense',
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59, 999),
      },
    };

    const transactions = await prisma.bankTransaction.findMany({ where });

    // Load all card owners
    const allOwners = await CardOwner.find({});
    const ownerMap = new Map(allOwners.map(o => [`${o.source}:${o.cardLast4}`, o.ownerName]));

    // Aggregate by owner
    const totals = new Map<string, number>();
    for (const t of transactions) {
      const ownerName = t.cardLast4
        ? (ownerMap.get(`${t.source}:${t.cardLast4}`) ?? null)
        : null;
      const key = ownerName ?? 'לא ידוע';
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(Number(t.chargedAmount)));
    }

    const breakdown = Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    res.json({ breakdown, total: breakdown.reduce((s, r) => s + r.total, 0) });
  } catch (err) { next(err); }
});

// ─── PATCH /api/bank/import/:batchId/stamp-card ───────────────────────────────
router.patch('/import/:batchId/stamp-card', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cardLast4 } = req.body;
    if (!cardLast4) { res.status(400).json({ error: 'cardLast4 required' }); return; }
    const result = await prisma.bankTransaction.updateMany({
      where: { importBatchId: req.params.batchId, cardLast4: null },
      data:  { cardLast4 },
    });
    res.json({ updated: result.count });
  } catch (err) { next(err); }
});

// ─── DELETE /api/bank/import/:batchId ─────────────────────────────────────────
router.delete('/import/:batchId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;

    const batchIdStr = String(batchId);
    await prisma.$transaction([
      prisma.bankTransaction.deleteMany({ where: { importBatchId: batchIdStr } }),
      prisma.importBatch.delete({ where: { id: batchIdStr } }),
    ]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/bank/batches ────────────────────────────────────────────────────
router.get('/batches', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(batches);
  } catch (err) {
    next(err);
  }
});

export default router;

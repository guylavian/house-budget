import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Category } from '../models/Category';

const router = Router();

// GET /api/house/export
router.get('/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { generateHouseExcel } = await import('../services/excelService');
    const workbook = await generateHouseExcel(prisma);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="house-expenses-export.xlsx"');
    const buf = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

// GET /api/house?month=&year=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year  = req.query.year  ? Number(req.query.year)  : undefined;

    const houseCategories = await Category.find({ isHouseCategory: true, isArchived: false });
    const houseCatIds = houseCategories.map(c => c._id.toString());
    const houseCatMap = new Map(houseCategories.map(c => [c._id.toString(), c]));

    const dateFilter = (month && year) ? {
      gte: new Date(year, month - 1, 1),
      lte: new Date(year, month, 0, 23, 59, 59, 999),
    } : year ? {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59, 999),
    } : undefined;

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        categoryId: { in: houseCatIds },
        ...(dateFilter ? { date: dateFilter } : {}),
        type: { not: 'transfer' },
      },
      orderBy: { date: 'desc' },
    });

    const enriched = transactions.map(t => ({
      ...t,
      category: t.categoryId ? (houseCatMap.get(t.categoryId) ?? null) : null,
    }));

    const byCategory = new Map<string, { name: string; color: string; icon: string; total: number; count: number }>();
    for (const t of transactions) {
      const cat  = t.categoryId ? houseCatMap.get(t.categoryId) : null;
      const name = cat?.name ?? 'אחר';
      const existing = byCategory.get(name);
      if (existing) {
        existing.total += Number(t.chargedAmount);
        existing.count += 1;
      } else {
        byCategory.set(name, {
          name,
          color: cat?.color ?? '#6B7280',
          icon:  cat?.icon  ?? '🏠',
          total: Number(t.chargedAmount),
          count: 1,
        });
      }
    }

    const total = transactions.reduce((s, t) => s + Number(t.chargedAmount), 0);

    res.json({
      transactions: enriched,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
      total,
      houseCategories: houseCategories.map(c => ({ _id: c._id, name: c.name, icon: c.icon, color: c.color })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

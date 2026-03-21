import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Category } from '../models/Category';
import type { DashboardQueryParams, MonthYearPoint, TrendDataPoint, CategoryTotal } from '../interfaces/dashboard';

const router = Router();

// GET /api/dashboard/summary?month=&year=
router.get('/summary', async (req: Request<object, object, object, DashboardQueryParams>, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : new Date().getFullYear();

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);

    const houseCats = await Category.find({ isHouseCategory: true, isArchived: false });
    const houseCatIds = houseCats.map(c => c._id.toString());

    const [salaries, expenses, houseTxns, savingsDeposits, bankTransactions] = await Promise.all([
      prisma.salary.findMany({ where: { month, year } }),
      prisma.expense.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.bankTransaction.findMany({
        where: { categoryId: { in: houseCatIds }, date: { gte: start, lte: end }, type: { not: 'transfer' } },
      }),
      prisma.savingsDeposit.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.bankTransaction.findMany({
        where: { date: { gte: start, lte: end }, type: { not: 'transfer' } },
      }),
    ]);

    const bankIncome   = bankTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.chargedAmount), 0);
    const bankExpenses = bankTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.chargedAmount), 0);
    const bankSavings  = bankTransactions.filter(t => t.type === 'savings').reduce((sum, t) => sum + Number(t.chargedAmount), 0);

    const totalIncome     = salaries.reduce((sum, s) => sum + Number(s.amount), 0) + bankIncome;
    const totalExpenses   = expenses.reduce((sum, e) => sum + Number(e.amount), 0) + bankExpenses;
    const houseTotal      = houseTxns.reduce((sum, t) => sum + Number(t.chargedAmount), 0);
    const savingsDeposited = savingsDeposits.reduce((sum, d) => sum + Number(d.amount), 0) + bankSavings;
    const netBalance      = totalIncome - totalExpenses - houseTotal - savingsDeposited;
    const savingsRate     = totalIncome > 0 ? (savingsDeposited / totalIncome) * 100 : 0;

    // Enrich expenses with category names from MongoDB
    const catIds = [...new Set([
      ...expenses.map(e => e.categoryId),
      ...bankTransactions.filter(t => t.type === 'expense').map(t => t.categoryId),
    ].filter(Boolean))];
    const categories = await Category.find({ _id: { $in: catIds } });
    const catMap = new Map(categories.map(c => [c._id.toString(), c.name]));

    const byCategoryMap = new Map<string, number>();
    for (const e of expenses) {
      const name = catMap.get(e.categoryId) ?? 'לא ידוע';
      byCategoryMap.set(name, (byCategoryMap.get(name) ?? 0) + Number(e.amount));
    }
    for (const t of bankTransactions.filter(tx => tx.type === 'expense')) {
      const name = catMap.get(t.categoryId ?? '') ?? 'אחר';
      byCategoryMap.set(name, (byCategoryMap.get(name) ?? 0) + Number(t.chargedAmount));
    }
    const expensesByCategory: CategoryTotal[] = Array.from(byCategoryMap.entries()).map(([categoryName, total]) => ({
      categoryName,
      total,
    }));

    // Last 6 months trend
    const trendMonths: MonthYearPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      trendMonths.push({ month: m, year: y });
    }

    const [last6MonthsIncome, last6MonthsExpenses]: [TrendDataPoint[], TrendDataPoint[]] = await Promise.all([
      Promise.all(
        trendMonths.map(async ({ month: m, year: y }): Promise<TrendDataPoint> => {
          const s = new Date(y, m - 1, 1);
          const e = new Date(y, m, 0, 23, 59, 59, 999);
          const [salaryResult, bankResult] = await Promise.all([
            prisma.salary.aggregate({ _sum: { amount: true }, where: { month: m, year: y } }),
            prisma.bankTransaction.aggregate({
              _sum: { chargedAmount: true },
              where: { date: { gte: s, lte: e }, type: 'income' },
            }),
          ]);
          return {
            month: m, year: y,
            total: Number(salaryResult._sum.amount ?? 0) + Number(bankResult._sum.chargedAmount ?? 0),
          };
        })
      ),
      Promise.all(
        trendMonths.map(async ({ month: m, year: y }): Promise<TrendDataPoint> => {
          const s = new Date(y, m - 1, 1);
          const e = new Date(y, m, 0, 23, 59, 59, 999);
          const [expResult, bankResult] = await Promise.all([
            prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: s, lte: e } } }),
            prisma.bankTransaction.aggregate({
              _sum: { chargedAmount: true },
              where: { date: { gte: s, lte: e }, type: 'expense' },
            }),
          ]);
          return {
            month: m,
            year:  y,
            total: Number(expResult._sum.amount ?? 0) + Number(bankResult._sum.chargedAmount ?? 0),
          };
        })
      ),
    ]);

    res.json({
      totalIncome,
      totalExpenses,
      houseTotal,
      savingsDeposited,
      netBalance,
      savingsRate,
      expensesByCategory,
      last6MonthsIncome,
      last6MonthsExpenses,
      bankIncome,
      bankExpenses,
      bankSavings,
      bankTransactionCount: bankTransactions.length,
      hasUnclassified: bankTransactions.some(t => t.confidence === 'manual'),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

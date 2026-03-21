import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { Category } from '../models/Category';
import type { ExpenseQueryParams, ExpenseWhereClause } from '../interfaces/expenses';

const router = Router();

const ExpenseSchema = z.object({
  categoryId:  z.string().min(1),
  amount:      z.number().positive(),
  date:        z.string().transform((val) => new Date(val)),
  description: z.string().min(1),
  isRecurring: z.boolean().default(false),
  paymentType: z.enum(['credit', 'debit', 'cash']),
  cardLast4:   z.string().length(4).optional().nullable(),
});

const CategorySchema = z.object({
  name:        z.string().min(1),
  icon:        z.string().optional().nullable(),
  color:       z.string().optional().nullable(),
  type:        z.enum(['expense', 'income', 'savings', 'transfer']).default('expense'),
  budgetAmount: z.number().min(0).optional().nullable(),
  sortOrder:   z.number().int().optional(),
});

// GET /api/expenses/categories
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await Category.find({ isArchived: false }).sort({ sortOrder: 1 });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses/categories
router.post('/categories', validate(CategorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await new Category(req.body).save();
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/categories/:id
router.delete('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isArchived: true });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/export
router.get('/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { generateExpensesExcel } = await import('../services/excelService');
    const workbook = await generateExpensesExcel(prisma);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses-export.xlsx"');
    const buf = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses?month=&year=&categoryId=
router.get('/', async (req: Request<object, object, object, ExpenseQueryParams>, res: Response, next: NextFunction) => {
  try {
    const month      = req.query.month      ? Number(req.query.month)      : undefined;
    const year       = req.query.year       ? Number(req.query.year)        : undefined;
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;

    const where: ExpenseWhereClause = {};

    if (categoryId) where.categoryId = categoryId;
    if (month && year) {
      where.date = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59, 999),
      };
    } else if (year) {
      where.date = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Enrich with category data from MongoDB (filter out legacy integer IDs)
    const catIds = [...new Set(expenses.map(e => e.categoryId).filter(id => id && /^[a-f\d]{24}$/i.test(id)))];
    const categories = await Category.find({ _id: { $in: catIds } });
    const catMap = new Map(categories.map(c => [c._id.toString(), c]));

    interface CategorySummaryLocal { categoryName: string; total: number; count: number }
    const byCategoryMap = new Map<string, CategorySummaryLocal>();
    const enrichedExpenses = expenses.map(e => {
      const cat = catMap.get(e.categoryId);
      const name = cat?.name ?? 'לא ידוע';
      const existing = byCategoryMap.get(name);
      if (existing) {
        existing.total += Number(e.amount);
        existing.count += 1;
      } else {
        byCategoryMap.set(name, { categoryName: name, total: Number(e.amount), count: 1 });
      }
      return { ...e, category: cat ?? null };
    });

    // Bank expense transactions for the same period
    const bankExpenseWhere: Record<string, unknown> = { type: 'expense' };
    if (categoryId) bankExpenseWhere.categoryId = categoryId;
    if (month && year) {
      bankExpenseWhere.date = { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) };
    } else if (year) {
      bankExpenseWhere.date = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    const bankExpenses = await prisma.bankTransaction.findMany({
      where: bankExpenseWhere,
      orderBy: { date: 'desc' },
    });

    const bankCatIds2 = [...new Set(bankExpenses.map(t => t.categoryId).filter(Boolean))];
    const bankCats2   = await Category.find({ _id: { $in: bankCatIds2 } });
    const bankCatMap2 = new Map(bankCats2.map(c => [c._id.toString(), c]));

    const bankAsExpense = bankExpenses.map(t => ({
      id:            t.id,
      _type:         'bank' as const,
      categoryId:    t.categoryId ?? '',
      category:      t.categoryId ? (bankCatMap2.get(t.categoryId) ?? null) : null,
      amount:        t.chargedAmount,
      date:          t.date,
      description:   t.description,
      isRecurring:   t.isRecurring,
      paymentType:   t.sourceType === 'credit' ? 'credit' as const : 'debit' as const,
      cardLast4:     null,
      source:        t.source,
      confidence:    t.confidence,
      memo:          t.memo,
      importBatchId: t.importBatchId,
      createdAt:     t.createdAt,
    }));

    for (const t of bankExpenses) {
      if (t.type === 'transfer') continue;
      const cat  = t.categoryId ? bankCatMap2.get(t.categoryId) : null;
      const name = cat?.name ?? 'לא מסווג';
      const existing = byCategoryMap.get(name);
      if (existing) {
        existing.total += Number(t.chargedAmount);
        existing.count += 1;
      } else {
        byCategoryMap.set(name, { categoryName: name, total: Number(t.chargedAmount), count: 1 });
      }
    }

    const manualExpTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const bankExpTotal   = bankExpenses.reduce((sum, t) => sum + Number(t.chargedAmount), 0);

    res.json({
      expenses:    [...enrichedExpenses, ...bankAsExpense],
      total:       manualExpTotal + bankExpTotal,
      manualTotal: manualExpTotal,
      bankTotal:   bankExpTotal,
      byCategory:  Array.from(byCategoryMap.values()),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses
router.post('/', validate(ExpenseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.create({ data: req.body });
    const cat = await Category.findById(expense.categoryId);
    res.status(201).json({ ...expense, category: cat ?? null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/expenses/:id
router.put('/:id', validate(ExpenseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: Number(req.params.id) },
      data:  req.body,
    });
    const cat = await Category.findById(expense.categoryId);
    res.json({ ...expense, category: cat ?? null });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.expense.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

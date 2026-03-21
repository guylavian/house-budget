import { Router, Request, Response, NextFunction } from 'express';
import { Category } from '../models/Category';
import { CardOwner } from '../models/CardOwner';
import { prisma } from '../lib/prisma';
import { CategoryRule } from '../models/CategoryRule';
import { HouseholdMember } from '../models/HouseholdMember';
import { SavingsGoal } from '../models/SavingsGoal';
import { BudgetLimit } from '../models/BudgetLimit';
import { AppSettings } from '../models/AppSettings';
import { classificationService } from '../services/classificationService';

const router = Router();

// ─── Categories ──────────────────────────────────────────────────────────────

// GET /api/config/categories
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await Category.find({ isArchived: false }).sort({ sortOrder: 1 });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/config/categories
router.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await new Category(req.body).save();
    await classificationService.reloadRules();
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config/categories/:id
router.put('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    await classificationService.reloadRules();
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/config/categories/:id/house-toggle
router.patch('/categories/:id/house-toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) { res.status(404).json({ error: 'Not found' }); return; }
    cat.isHouseCategory = !cat.isHouseCategory;
    await cat.save();
    res.json(cat);
  } catch (err) { next(err); }
});

// DELETE /api/config/categories/:id  — soft delete
router.delete('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { new: true }
    );
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    await classificationService.reloadRules();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Category Rules ───────────────────────────────────────────────────────────

// GET /api/config/rules
router.get('/rules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await CategoryRule.find({}).sort({ priority: -1 });
    // Manually populate category name
    const catIds = [...new Set(rules.map(r => r.categoryId))];
    const categories = await Category.find({ _id: { $in: catIds } });
    const catMap = new Map(categories.map(c => [c._id.toString(), c.name]));
    const enriched = rules.map(r => ({
      ...r.toObject(),
      categoryName: catMap.get(r.categoryId) ?? 'לא ידוע',
    }));
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/config/rules
router.post('/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await new CategoryRule(req.body).save();
    await classificationService.reloadRules();
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config/rules/:id
router.put('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await CategoryRule.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    await classificationService.reloadRules();
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/config/rules/:id
router.delete('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await CategoryRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    await classificationService.reloadRules();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Household Members ────────────────────────────────────────────────────────

// GET /api/config/members
router.get('/members', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await HouseholdMember.find({ isActive: true });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// POST /api/config/members
router.post('/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await new HouseholdMember(req.body).save();
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config/members/:id
router.put('/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await HouseholdMember.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    res.json(member);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/config/members/:id  — soft delete
router.delete('/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await HouseholdMember.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Savings Goals ────────────────────────────────────────────────────────────

// GET /api/config/goals
router.get('/goals', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await SavingsGoal.find({});
    res.json(goals);
  } catch (err) {
    next(err);
  }
});

// POST /api/config/goals
router.post('/goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goal = await new SavingsGoal(req.body).save();
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config/goals/:id
router.put('/goals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goal = await SavingsGoal.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json(goal);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/config/goals/:id
router.delete('/goals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goal = await SavingsGoal.findByIdAndDelete(req.params.id);
    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Budget Limits ────────────────────────────────────────────────────────────

// GET /api/config/budgets
router.get('/budgets', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const budgets = await BudgetLimit.find({});
    res.json(budgets);
  } catch (err) {
    next(err);
  }
});

// POST /api/config/budgets  — upsert by categoryId + isRecurring
router.post('/budgets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, isRecurring, amount, month, year } = req.body as {
      categoryId: string;
      isRecurring: boolean;
      amount: number;
      month?: number;
      year?: number;
    };

    const filter = isRecurring
      ? { categoryId, isRecurring: true }
      : { categoryId, isRecurring: false, month, year };

    const budget = await BudgetLimit.findOneAndUpdate(
      filter,
      { $set: { amount, ...(isRecurring ? {} : { month, year }) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(budget);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/config/budgets/:id
router.delete('/budgets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const budget = await BudgetLimit.findByIdAndDelete(req.params.id);
    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── App Settings ─────────────────────────────────────────────────────────────

// GET /api/config/settings
router.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await AppSettings.findOne({});
    if (!settings) {
      settings = await AppSettings.create({});
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config/settings
router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// GET /api/config/card-owners
router.get('/card-owners', async (_req, res, next) => {
  try {
    const owners = await CardOwner.find({}).sort({ ownerName: 1 });
    res.json(owners);
  } catch (err) { next(err); }
});

// POST /api/config/card-owners
router.post('/card-owners', async (req, res, next) => {
  try {
    const { source, cardLast4, ownerName } = req.body as { source: string; cardLast4: string; ownerName: string };
    if (!source || !cardLast4 || !ownerName) {
      res.status(400).json({ error: 'source, cardLast4, ownerName required' }); return;
    }
    const owner = await CardOwner.findOneAndUpdate(
      { source, cardLast4 },
      { ownerName },
      { upsert: true, new: true }
    );
    res.status(201).json(owner);
  } catch (err) { next(err); }
});

// DELETE /api/config/card-owners/:id
router.delete('/card-owners/:id', async (req, res, next) => {
  try {
    await CardOwner.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/config/card-owners/backfill
// Body (optional): { source: string, cardLast4: string }
// If body provided → stamp that specific card onto all null-cardLast4 rows for that source
// If no body → auto-stamp only sources with exactly one configured card (original behavior)
router.post('/card-owners/backfill', async (req, res, next) => {
  try {
    const { source: forceSource, cardLast4: forceCard } = req.body ?? {};

    // --- Manual mode: force-stamp a specific source+card ---
    if (forceSource && forceCard) {
      const result = await prisma.bankTransaction.updateMany({
        where: { source: forceSource, cardLast4: null },
        data:  { cardLast4: forceCard },
      });
      res.json({
        totalUpdated: result.count,
        details: [{ source: forceSource, cardLast4: forceCard, updated: result.count }],
      });
      return;
    }

    // --- Auto mode: only sources with exactly one configured card ---
    const allOwners = await CardOwner.find({});
    const bySource  = new Map<string, string[]>();
    for (const o of allOwners) {
      const list = bySource.get(o.source) ?? [];
      list.push(o.cardLast4);
      bySource.set(o.source, list);
    }

    let totalUpdated = 0;
    const details: { source: string; cardLast4: string; updated: number }[] = [];

    for (const [source, cards] of bySource.entries()) {
      if (cards.length !== 1) continue;
      const result = await prisma.bankTransaction.updateMany({
        where: { source, cardLast4: null },
        data:  { cardLast4: cards[0] },
      });
      totalUpdated += result.count;
      details.push({ source, cardLast4: cards[0], updated: result.count });
    }

    res.json({ totalUpdated, details });
  } catch (err) { next(err); }
});

// POST /api/config/card-owners/fix-sources
// One-time cleanup of mis-named source values (e.g. Hebrew display names stored as source)
router.post('/card-owners/fix-sources', async (_req, res, next) => {
  try {
    const SOURCE_MAP: Record<string, string> = {
      'מקס':          'max',
      'ישראכרט':      'isracard',
      'כאל':          'diners',
      'כאל / דיינרס': 'diners',
      'דיינרס':       'diners',
      'אוצר החייל':   'otsar_hahayal',
    };
    let fixed = 0;
    for (const [wrong, correct] of Object.entries(SOURCE_MAP)) {
      const result = await CardOwner.updateMany(
        { source: wrong },
        { $set: { source: correct } }
      );
      fixed += result.modifiedCount;
    }
    res.json({ fixed });
  } catch (err) { next(err); }
});

export default router;

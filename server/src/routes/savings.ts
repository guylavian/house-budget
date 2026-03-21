import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { SavingsGoal } from '../models/SavingsGoal';
import type { DepositRequestBody } from '../interfaces/savings';

const router = Router();

const SavingsGoalSchema = z.object({
  name:          z.string().min(1),
  targetAmount:  z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  deadline:      z.string().transform((val) => new Date(val)).optional().nullable(),
  color:         z.string().optional().nullable(),
  icon:          z.string().optional().nullable(),
  notes:         z.string().optional().nullable(),
});

const DepositSchema = z.object({
  amount: z.number().positive(),
  date:   z.string().transform((val) => new Date(val)),
  notes:  z.string().optional().nullable(),
});

// GET /api/savings/export
router.get('/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { generateSavingsExcel } = await import('../services/excelService');
    const workbook = await generateSavingsExcel(prisma);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="savings-export.xlsx"');
    const buf = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

// GET /api/savings
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await SavingsGoal.find({}).sort({ createdAt: -1 });

    // Fetch deposit counts from Postgres per goal
    const goalIds = goals.map(g => g._id.toString());
    const depositCounts = await prisma.savingsDeposit.groupBy({
      by: ['goalId'],
      _count: { id: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { goalId: { in: goalIds } } as any,
    });
    const countMap = new Map(depositCounts.map(d => [d.goalId, d._count.id]));

    // Fetch recent deposits per goal
    const recentDeposits = await prisma.savingsDeposit.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { goalId: { in: goalIds } } as any,
      orderBy: { date: 'desc' },
      take: 10 * goalIds.length,
    });
    const depositsByGoal = new Map<string, typeof recentDeposits>();
    for (const d of recentDeposits) {
      const arr = depositsByGoal.get(d.goalId) ?? [];
      if (arr.length < 10) arr.push(d);
      depositsByGoal.set(d.goalId, arr);
    }

    const enriched = goals.map(g => ({
      ...g.toObject(),
      depositCount: countMap.get(g._id.toString()) ?? 0,
      deposits:     depositsByGoal.get(g._id.toString()) ?? [],
      progress:
        Number(g.targetAmount) > 0
          ? Math.min(100, (Number(g.currentAmount) / Number(g.targetAmount)) * 100)
          : 0,
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/savings
router.post('/', validate(SavingsGoalSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goal = await new SavingsGoal(req.body).save();
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

// PUT /api/savings/:id
router.put('/:id', validate(SavingsGoalSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// DELETE /api/savings/deposit/:depositId  — must be before /:id to avoid route conflict
router.delete('/deposit/:depositId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const depositId = Number(req.params.depositId);

    const deposit = await prisma.savingsDeposit.findUniqueOrThrow({
      where: { id: depositId },
    });

    // Delete deposit from Postgres and decrement currentAmount in MongoDB
    await prisma.savingsDeposit.delete({ where: { id: depositId } });
    await SavingsGoal.findByIdAndUpdate(deposit.goalId, {
      $inc: { currentAmount: -Number(deposit.amount) },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/savings/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalId = String(req.params.id);

    // Cascade: delete deposits in Postgres, then goal in MongoDB
    await prisma.savingsDeposit.deleteMany({ where: { goalId: goalId } });
    await SavingsGoal.findByIdAndDelete(goalId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/savings/:id/deposit
router.post(
  '/:id/deposit',
  validate(DepositSchema),
  async (req: Request<{ id: string }, object, DepositRequestBody>, res: Response, next: NextFunction) => {
    try {
      const goalId = req.params.id;
      const { amount, date, notes } = req.body;

      // Verify goal exists
      const goal = await SavingsGoal.findById(goalId);
      if (!goal) {
        res.status(404).json({ error: 'Goal not found' });
        return;
      }

      // Create deposit in Postgres
      const deposit = await prisma.savingsDeposit.create({
        data: { goalId, amount, date, notes },
      });

      // Increment currentAmount in MongoDB
      await SavingsGoal.findByIdAndUpdate(goalId, {
        $inc: { currentAmount: amount },
      });

      res.status(201).json(deposit);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

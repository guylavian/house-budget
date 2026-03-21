import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { HouseholdMember } from '../models/HouseholdMember';
import { Category } from '../models/Category';
import type { SalaryQueryParams, SalaryWhereClause } from '../interfaces/salary';

const router = Router();

const SalarySchema = z.object({
  memberId: z.string().min(1),
  amount:   z.number().positive(),
  month:    z.number().int().min(1).max(12),
  year:     z.number().int().min(2000).max(2100),
  type:     z.enum(['gross', 'net']),
  notes:    z.string().optional().nullable(),
});

const MemberSchema = z.object({
  name:         z.string().min(1),
  role:         z.enum(['primary', 'partner', 'other']),
  avatar:       z.string().optional().nullable(),
  salaryTarget: z.number().min(0).optional().nullable(),
});

// GET /api/salary/members
router.get('/members', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await HouseholdMember.find({ isActive: true });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// POST /api/salary/members
router.post('/members', validate(MemberSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await new HouseholdMember(req.body).save();
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

// GET /api/salary/export
router.get('/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { generateSalaryExcel } = await import('../services/excelService');
    const workbook = await generateSalaryExcel(prisma);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="salary-export.xlsx"');
    const buf = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

// GET /api/salary?month=&year=
router.get('/', async (req: Request<object, object, object, SalaryQueryParams>, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year  = req.query.year  ? Number(req.query.year)  : undefined;

    const where: SalaryWhereClause = {};
    if (month) where.month = month;
    if (year)  where.year  = year;

    const salaries = await prisma.salary.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });

    // Enrich with member data from MongoDB (filter out legacy integer IDs)
    const memberIds = [...new Set(salaries.map(s => s.memberId).filter(id => id && /^[a-f\d]{24}$/i.test(id)))];
    const members   = await HouseholdMember.find({ _id: { $in: memberIds } });
    const memberMap = new Map(members.map(m => [m._id.toString(), m]));

    const enriched = salaries.map(s => ({
      ...s,
      _type: 'manual' as const,
      member: memberMap.get(s.memberId) ?? null,
    }));

    // Bank income transactions for the same period
    const dateWhere: Record<string, unknown> = {};
    if (month && year) {
      dateWhere.date = { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) };
    } else if (year) {
      dateWhere.date = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    const bankIncome = await prisma.bankTransaction.findMany({
      where: { ...dateWhere, type: 'income' },
      orderBy: { date: 'desc' },
    });

    const bankCatIds = [...new Set(bankIncome.map(t => t.categoryId).filter(Boolean))];
    const bankCategories = await Category.find({ _id: { $in: bankCatIds } });
    const bankCatMap = new Map(bankCategories.map(c => [c._id.toString(), c]));

    const bankAsSalary = bankIncome.map(t => ({
      id:            t.id,
      _type:         'bank' as const,
      memberId:      null,
      member:        null,
      amount:        t.chargedAmount,
      month:         t.date.getMonth() + 1,
      year:          t.date.getFullYear(),
      type:          'net' as const,
      notes:         t.description,
      date:          t.date,
      source:        t.source,
      categoryId:    t.categoryId,
      category:      t.categoryId ? (bankCatMap.get(t.categoryId) ?? null) : null,
      confidence:    t.confidence,
      importBatchId: t.importBatchId,
      createdAt:     t.createdAt,
    }));

    const manualTotal = salaries.reduce((sum, s) => sum + Number(s.amount), 0);
    const bankTotal   = bankIncome.reduce((sum, t) => sum + Number(t.chargedAmount), 0);

    res.json({
      salaries:    [...enriched, ...bankAsSalary],
      total:       manualTotal + bankTotal,
      manualTotal,
      bankTotal,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/salary
router.post('/', validate(SalarySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const salary = await prisma.salary.create({ data: req.body });
    const member = await HouseholdMember.findById(salary.memberId);
    res.status(201).json({ ...salary, member: member ?? null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/salary/:id
router.put('/:id', validate(SalarySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const salary = await prisma.salary.update({
      where: { id: Number(req.params.id) },
      data:  req.body,
    });
    const member = await HouseholdMember.findById(salary.memberId);
    res.json({ ...salary, member: member ?? null });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/salary/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.salary.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

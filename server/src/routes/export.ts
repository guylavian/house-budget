import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { generateFullReportExcel } from '../services/excelService';

const router = Router();

// GET /api/export/full
router.get('/full', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const workbook = await generateFullReportExcel(prisma);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="full-report.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export default router;

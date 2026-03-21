import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { Category } from '../models/Category';
import { HouseholdMember } from '../models/HouseholdMember';
import { SavingsGoal } from '../models/SavingsGoal';

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
  },
};

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.style = HEADER_STYLE;
  });
  row.height = 24;
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateSalaryExcel(prisma: PrismaClient): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Household Budget Manager';
  workbook.created = new Date();

  const salaries = await prisma.salary.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  // Enrich with MongoDB members (filter out legacy integer IDs)
  const memberIds = [...new Set(salaries.map(s => s.memberId).filter(id => id && /^[a-f\d]{24}$/i.test(id)))];
  const members   = await HouseholdMember.find({ _id: { $in: memberIds } });
  const memberMap = new Map(members.map(m => [m._id.toString(), m.name]));

  // Sheet 1: Monthly breakdown
  const sheet1 = workbook.addWorksheet('פירוט חודשי');
  sheet1.columns = [
    { header: 'חודש',   key: 'month',  width: 10 },
    { header: 'שנה',    key: 'year',   width: 10 },
    { header: 'שם',     key: 'member', width: 20 },
    { header: 'סוג',    key: 'type',   width: 12 },
    { header: 'סכום',   key: 'amount', width: 18 },
    { header: 'הערות',  key: 'notes',  width: 30 },
  ];
  applyHeaderStyle(sheet1.getRow(1));

  for (const s of salaries) {
    sheet1.addRow({
      month:  s.month,
      year:   s.year,
      member: memberMap.get(s.memberId) ?? s.memberId,
      type:   s.type === 'gross' ? 'ברוטו' : 'נטו',
      amount: formatCurrency(Number(s.amount)),
      notes:  s.notes ?? '',
    });
  }

  // Sheet 2: Yearly totals per member
  const sheet2 = workbook.addWorksheet('סיכום שנתי');
  sheet2.columns = [
    { header: 'שם',    key: 'member', width: 20 },
    { header: 'שנה',   key: 'year',   width: 10 },
    { header: 'סוג',   key: 'type',   width: 12 },
    { header: 'סה"כ', key: 'total',  width: 18 },
  ];
  applyHeaderStyle(sheet2.getRow(1));

  const yearlyTotals = new Map<string, number>();
  for (const s of salaries) {
    const memberName = memberMap.get(s.memberId) ?? s.memberId;
    const key = `${memberName}|${s.year}|${s.type}`;
    yearlyTotals.set(key, (yearlyTotals.get(key) ?? 0) + Number(s.amount));
  }

  for (const [key, total] of yearlyTotals.entries()) {
    const [member, year, type] = key.split('|');
    sheet2.addRow({
      member,
      year:  Number(year),
      type:  type === 'gross' ? 'ברוטו' : 'נטו',
      total: formatCurrency(total),
    });
  }

  return workbook;
}

export async function generateExpensesExcel(prisma: PrismaClient): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Household Budget Manager';
  workbook.created = new Date();

  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });

  // Enrich with MongoDB categories
  const catIds = [...new Set(expenses.map(e => e.categoryId).filter(Boolean))];
  const categories = await Category.find({ _id: { $in: catIds } });
  const catMap = new Map(categories.map(c => [c._id.toString(), c.name]));

  // Sheet 1: All expenses
  const sheet1 = workbook.addWorksheet('כל ההוצאות');
  sheet1.columns = [
    { header: 'תאריך',           key: 'date',        width: 14 },
    { header: 'קטגוריה',         key: 'category',    width: 18 },
    { header: 'תיאור',           key: 'description', width: 30 },
    { header: 'סכום',            key: 'amount',      width: 18 },
    { header: 'אמצעי תשלום',    key: 'paymentType', width: 16 },
    { header: '4 ספרות כרטיס',  key: 'cardLast4',   width: 16 },
  ];
  applyHeaderStyle(sheet1.getRow(1));

  for (const e of expenses) {
    sheet1.addRow({
      date:        new Date(e.date).toLocaleDateString('he-IL'),
      category:    catMap.get(e.categoryId) ?? 'לא ידוע',
      description: e.description,
      amount:      formatCurrency(Number(e.amount)),
      paymentType: e.paymentType === 'credit' ? 'אשראי' : e.paymentType === 'debit' ? 'דביט' : 'מזומן',
      cardLast4:   e.cardLast4 ?? '',
    });
  }

  // Sheet 2: Category totals per month
  const sheet2 = workbook.addWorksheet('לפי קטגוריה');
  sheet2.columns = [
    { header: 'קטגוריה', key: 'category', width: 20 },
    { header: 'חודש',    key: 'month',    width: 10 },
    { header: 'שנה',     key: 'year',     width: 10 },
    { header: 'סה"כ',   key: 'total',    width: 18 },
  ];
  applyHeaderStyle(sheet2.getRow(1));

  const catMonthTotals = new Map<string, number>();
  for (const e of expenses) {
    const d = new Date(e.date);
    const catName = catMap.get(e.categoryId) ?? 'לא ידוע';
    const key = `${catName}|${d.getMonth() + 1}|${d.getFullYear()}`;
    catMonthTotals.set(key, (catMonthTotals.get(key) ?? 0) + Number(e.amount));
  }

  for (const [key, total] of catMonthTotals.entries()) {
    const [category, month, year] = key.split('|');
    sheet2.addRow({ category, month: Number(month), year: Number(year), total: formatCurrency(total) });
  }

  // Sheet 3: Monthly summary
  const sheet3 = workbook.addWorksheet('סיכום חודשי');
  sheet3.columns = [
    { header: 'חודש',          key: 'month', width: 10 },
    { header: 'שנה',           key: 'year',  width: 10 },
    { header: 'סה"כ הוצאות', key: 'total', width: 18 },
    { header: 'מספר רשומות',  key: 'count', width: 16 },
  ];
  applyHeaderStyle(sheet3.getRow(1));

  const monthlyTotals = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const d   = new Date(e.date);
    const key = `${d.getMonth() + 1}|${d.getFullYear()}`;
    const existing = monthlyTotals.get(key);
    if (existing) {
      existing.total += Number(e.amount);
      existing.count += 1;
    } else {
      monthlyTotals.set(key, { total: Number(e.amount), count: 1 });
    }
  }

  for (const [key, { total, count }] of monthlyTotals.entries()) {
    const [month, year] = key.split('|');
    sheet3.addRow({ month: Number(month), year: Number(year), total: formatCurrency(total), count });
  }

  return workbook;
}

export async function generateHouseExcel(prisma: PrismaClient): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Household Budget Manager';
  workbook.created = new Date();

  const houseCategories = await Category.find({ isHouseCategory: true, isArchived: false });
  const houseCatIds = houseCategories.map(c => c._id.toString());
  const houseCatMap = new Map(houseCategories.map(c => [c._id.toString(), c]));

  const transactions = await prisma.bankTransaction.findMany({
    where: { categoryId: { in: houseCatIds }, type: { not: 'transfer' } },
    orderBy: { date: 'asc' },
  });

  // Sheet 1: All house transactions
  const sheet1 = workbook.addWorksheet('הוצאות בית');
  sheet1.columns = [
    { header: 'תאריך',    key: 'date',        width: 14 },
    { header: 'קטגוריה', key: 'category',    width: 18 },
    { header: 'תיאור',   key: 'description', width: 30 },
    { header: 'סכום',    key: 'amount',      width: 18 },
    { header: 'מקור',    key: 'source',      width: 16 },
  ];
  applyHeaderStyle(sheet1.getRow(1));

  for (const t of transactions) {
    const cat = t.categoryId ? houseCatMap.get(t.categoryId) : null;
    sheet1.addRow({
      date:        new Date(t.date).toLocaleDateString('he-IL'),
      category:    cat ? `${cat.icon} ${cat.name}` : 'אחר',
      description: t.description,
      amount:      formatCurrency(Number(t.chargedAmount)),
      source:      t.source,
    });
  }

  // Sheet 2: Monthly totals by category
  const sheet2 = workbook.addWorksheet('סיכום חודשי');
  sheet2.columns = [
    { header: 'חודש',    key: 'month',    width: 10 },
    { header: 'שנה',     key: 'year',     width: 10 },
    { header: 'קטגוריה', key: 'category', width: 18 },
    { header: 'סה"כ',   key: 'total',    width: 18 },
    { header: 'תנועות',  key: 'count',    width: 10 },
  ];
  applyHeaderStyle(sheet2.getRow(1));

  const monthCatMap = new Map<string, { month: number; year: number; category: string; total: number; count: number }>();
  for (const t of transactions) {
    const d = new Date(t.date);
    const cat = t.categoryId ? houseCatMap.get(t.categoryId) : null;
    const catName = cat ? cat.name : 'אחר';
    const key = `${d.getMonth() + 1}|${d.getFullYear()}|${catName}`;
    const existing = monthCatMap.get(key);
    if (existing) {
      existing.total += Number(t.chargedAmount);
      existing.count += 1;
    } else {
      monthCatMap.set(key, { month: d.getMonth() + 1, year: d.getFullYear(), category: catName, total: Number(t.chargedAmount), count: 1 });
    }
  }

  for (const entry of Array.from(monthCatMap.values()).sort((a, b) => a.year - b.year || a.month - b.month)) {
    sheet2.addRow({
      month:    entry.month,
      year:     entry.year,
      category: entry.category,
      total:    formatCurrency(entry.total),
      count:    entry.count,
    });
  }

  return workbook;
}

export async function generateSavingsExcel(prisma: PrismaClient): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Household Budget Manager';
  workbook.created = new Date();

  // Goals from MongoDB, deposits from Postgres
  const goals    = await SavingsGoal.find({}).sort({ createdAt: 1 });
  const goalIds  = goals.map(g => g._id.toString());
  const deposits = await prisma.savingsDeposit.findMany({
    where:   { goalId: { in: goalIds } },
    orderBy: { date: 'asc' },
  });

  const depositsByGoal = new Map<string, typeof deposits>();
  for (const d of deposits) {
    const arr = depositsByGoal.get(d.goalId) ?? [];
    arr.push(d);
    depositsByGoal.set(d.goalId, arr);
  }

  // Sheet 1: Goals
  const sheet1 = workbook.addWorksheet('יעדי חיסכון');
  sheet1.columns = [
    { header: 'שם',           key: 'name',          width: 22 },
    { header: 'יעד',          key: 'targetAmount',  width: 18 },
    { header: 'נוכחי',        key: 'currentAmount', width: 18 },
    { header: 'אחוז התקדמות', key: 'progress',      width: 18 },
    { header: 'יעד תאריך',   key: 'deadline',      width: 16 },
  ];
  applyHeaderStyle(sheet1.getRow(1));

  for (const g of goals) {
    const progress =
      Number(g.targetAmount) > 0
        ? ((Number(g.currentAmount) / Number(g.targetAmount)) * 100).toFixed(1)
        : '0';
    sheet1.addRow({
      name:          g.name,
      targetAmount:  formatCurrency(Number(g.targetAmount)),
      currentAmount: formatCurrency(Number(g.currentAmount)),
      progress:      `${progress}%`,
      deadline:      g.deadline ? new Date(g.deadline).toLocaleDateString('he-IL') : 'ללא הגבלה',
    });
  }

  // Sheet 2: Deposit history
  const sheet2 = workbook.addWorksheet('היסטוריית הפקדות');
  sheet2.columns = [
    { header: 'יעד',    key: 'goal',   width: 22 },
    { header: 'תאריך', key: 'date',   width: 14 },
    { header: 'סכום',  key: 'amount', width: 18 },
    { header: 'הערות', key: 'notes',  width: 30 },
  ];
  applyHeaderStyle(sheet2.getRow(1));

  for (const g of goals) {
    const goalDeposits = depositsByGoal.get(g._id.toString()) ?? [];
    for (const d of goalDeposits) {
      sheet2.addRow({
        goal:   g.name,
        date:   new Date(d.date).toLocaleDateString('he-IL'),
        amount: formatCurrency(Number(d.amount)),
        notes:  d.notes ?? '',
      });
    }
  }

  return workbook;
}

export async function generateFullReportExcel(prisma: PrismaClient): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Household Budget Manager';
  workbook.created = new Date();

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);

  const houseCatsForReport = await Category.find({ isHouseCategory: true, isArchived: false });
  const houseCatIdsForReport = houseCatsForReport.map(c => c._id.toString());
  const houseCatMapForReport = new Map(houseCatsForReport.map(c => [c._id.toString(), c]));

  const [salaries, expenses, houseTransactions, savingsDeposits] = await Promise.all([
    prisma.salary.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
    prisma.bankTransaction.findMany({
      where: { categoryId: { in: houseCatIdsForReport }, type: { not: 'transfer' } },
      orderBy: { date: 'asc' },
    }),
    prisma.savingsDeposit.findMany({ where: { date: { gte: start, lte: end } } }),
  ]);

  const goals = await SavingsGoal.find({}).sort({ createdAt: 1 });

  const isObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

  // Enrich (filter out legacy integer IDs that can't be cast to ObjectId)
  const memberIds = [...new Set(salaries.map(s => s.memberId).filter(id => id && isObjectId(id)))];
  const catIds    = [...new Set(expenses.map(e => e.categoryId).filter(id => id && isObjectId(id)))];
  const [members, categories] = await Promise.all([
    HouseholdMember.find({ _id: { $in: memberIds } }),
    Category.find({ _id: { $in: catIds } }),
  ]);
  const memberMap = new Map(members.map(m  => [m._id.toString(), m.name]));
  const catMap    = new Map(categories.map(c => [c._id.toString(), c.name]));

  // Dashboard summary sheet
  const dashSheet = workbook.addWorksheet('סיכום כללי');
  dashSheet.columns = [
    { header: 'מדד', key: 'metric', width: 28 },
    { header: 'ערך', key: 'value',  width: 22 },
  ];
  applyHeaderStyle(dashSheet.getRow(1));

  const totalIncome = salaries
    .filter(s => s.month === month && s.year === year)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExpenses = expenses
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const houseTotal       = houseTransactions
    .filter(t => { const d = new Date(t.date); return d.getMonth() + 1 === month && d.getFullYear() === year; })
    .reduce((sum, t) => sum + Number(t.chargedAmount), 0);
  const savingsDeposited = savingsDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const netBalance       = totalIncome - totalExpenses - houseTotal - savingsDeposited;
  const savingsRate      = totalIncome > 0 ? ((savingsDeposited / totalIncome) * 100).toFixed(1) : '0';

  dashSheet.addRow({ metric: 'סה"כ הכנסות (חודש נוכחי)', value: formatCurrency(totalIncome) });
  dashSheet.addRow({ metric: 'סה"כ הוצאות (חודש נוכחי)', value: formatCurrency(totalExpenses) });
  dashSheet.addRow({ metric: 'הוצאות בית (חודש נוכחי)', value: formatCurrency(houseTotal) });
  dashSheet.addRow({ metric: 'חיסכון (חודש נוכחי)', value: formatCurrency(savingsDeposited) });
  dashSheet.addRow({ metric: 'יתרה נטו', value: formatCurrency(netBalance) });
  dashSheet.addRow({ metric: 'אחוז חיסכון', value: `${savingsRate}%` });

  // Salary sheet
  const salSheet = workbook.addWorksheet('משכורות');
  salSheet.columns = [
    { header: 'חודש', key: 'month',  width: 10 },
    { header: 'שנה',  key: 'year',   width: 10 },
    { header: 'שם',   key: 'member', width: 20 },
    { header: 'סוג',  key: 'type',   width: 12 },
    { header: 'סכום', key: 'amount', width: 18 },
  ];
  applyHeaderStyle(salSheet.getRow(1));
  for (const s of salaries) {
    salSheet.addRow({
      month:  s.month,
      year:   s.year,
      member: memberMap.get(s.memberId) ?? s.memberId,
      type:   s.type === 'gross' ? 'ברוטו' : 'נטו',
      amount: formatCurrency(Number(s.amount)),
    });
  }

  // Expenses sheet
  const expSheet = workbook.addWorksheet('הוצאות');
  expSheet.columns = [
    { header: 'תאריך',        key: 'date',        width: 14 },
    { header: 'קטגוריה',      key: 'category',    width: 18 },
    { header: 'תיאור',        key: 'description', width: 30 },
    { header: 'סכום',         key: 'amount',      width: 18 },
    { header: 'אמצעי תשלום', key: 'paymentType', width: 16 },
  ];
  applyHeaderStyle(expSheet.getRow(1));
  for (const e of expenses) {
    expSheet.addRow({
      date:        new Date(e.date).toLocaleDateString('he-IL'),
      category:    catMap.get(e.categoryId) ?? 'לא ידוע',
      description: e.description,
      amount:      formatCurrency(Number(e.amount)),
      paymentType: e.paymentType === 'credit' ? 'אשראי' : e.paymentType === 'debit' ? 'דביט' : 'מזומן',
    });
  }

  // House sheet
  const houseSheet = workbook.addWorksheet('הוצאות בית');
  houseSheet.columns = [
    { header: 'תאריך',    key: 'date',        width: 14 },
    { header: 'קטגוריה', key: 'category',    width: 18 },
    { header: 'תיאור',   key: 'description', width: 30 },
    { header: 'סכום',    key: 'amount',      width: 18 },
  ];
  applyHeaderStyle(houseSheet.getRow(1));
  for (const t of houseTransactions) {
    const cat = t.categoryId ? houseCatMapForReport.get(t.categoryId) : null;
    houseSheet.addRow({
      date:        new Date(t.date).toLocaleDateString('he-IL'),
      category:    cat ? `${cat.icon} ${cat.name}` : 'אחר',
      description: t.description,
      amount:      formatCurrency(Number(t.chargedAmount)),
    });
  }

  // Savings sheet
  const savSheet = workbook.addWorksheet('חיסכון');
  savSheet.columns = [
    { header: 'שם',   key: 'name',          width: 22 },
    { header: 'יעד',  key: 'targetAmount',  width: 18 },
    { header: 'נוכחי', key: 'currentAmount', width: 18 },
    { header: 'אחוז', key: 'progress',      width: 12 },
  ];
  applyHeaderStyle(savSheet.getRow(1));
  for (const g of goals) {
    const progress =
      Number(g.targetAmount) > 0
        ? ((Number(g.currentAmount) / Number(g.targetAmount)) * 100).toFixed(1)
        : '0';
    savSheet.addRow({
      name:          g.name,
      targetAmount:  formatCurrency(Number(g.targetAmount)),
      currentAmount: formatCurrency(Number(g.currentAmount)),
      progress:      `${progress}%`,
    });
  }

  return workbook;
}

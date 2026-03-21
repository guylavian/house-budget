import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create household members
  const guy = await prisma.householdMember.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Guy', role: 'primary' },
  });

  const dana = await prisma.householdMember.upsert({
    where: { id: 2 },
    update: {},
    create: { name: 'Dana', role: 'partner' },
  });

  console.log('Created members:', guy.name, dana.name);

  // Create 6 months of salary data for each member (months 1-6 of 2025)
  const salaryData = [];
  for (let month = 1; month <= 6; month++) {
    salaryData.push(
      {
        memberId: guy.id,
        amount: 20000.0,
        month,
        year: 2025,
        type: 'gross',
        notes: `משכורת ברוטו - חודש ${month}`,
      },
      {
        memberId: guy.id,
        amount: 15000.0,
        month,
        year: 2025,
        type: 'net',
        notes: `משכורת נטו - חודש ${month}`,
      },
      {
        memberId: dana.id,
        amount: 18000.0,
        month,
        year: 2025,
        type: 'gross',
        notes: `משכורת ברוטו - חודש ${month}`,
      },
      {
        memberId: dana.id,
        amount: 14000.0,
        month,
        year: 2025,
        type: 'net',
        notes: `משכורת נטו - חודש ${month}`,
      }
    );
  }

  await prisma.salary.createMany({ data: salaryData, skipDuplicates: true });
  console.log('Created salary data for 6 months');

  // Create expense categories
  const categoryData = [
    { name: 'מזון', icon: '🛒' },
    { name: 'תחבורה', icon: '🚗' },
    { name: 'שירותים', icon: '💡' },
    { name: 'בידור', icon: '🎬' },
    { name: 'בריאות', icon: '💊' },
    { name: 'ביגוד', icon: '👕' },
    { name: 'חינוך', icon: '📚' },
    { name: 'אחר', icon: '📦' },
  ];

  const categories: { id: number; name: string; icon: string | null }[] = [];
  for (const cat of categoryData) {
    const created = await prisma.expenseCategory.upsert({
      where: { id: categoryData.indexOf(cat) + 1 },
      update: {},
      create: cat,
    });
    categories.push(created);
  }

  console.log('Created expense categories');

  // Create 3 months of expenses (months 1-3 of 2025)
  const expenseData = [];
  for (let month = 1; month <= 3; month++) {
    for (const cat of categories) {
      const amounts: Record<string, number> = {
        'מזון': 2500,
        'תחבורה': 800,
        'שירותים': 600,
        'בידור': 500,
        'בריאות': 400,
        'ביגוד': 300,
        'חינוך': 700,
        'אחר': 200,
      };
      const amount = amounts[cat.name] ?? 300;

      expenseData.push({
        categoryId: cat.id,
        amount,
        date: new Date(`2025-${String(month).padStart(2, '0')}-05T00:00:00Z`),
        description: `${cat.name} - חודש ${month}`,
        isRecurring: ['מזון', 'תחבורה', 'שירותים'].includes(cat.name),
        paymentType: month % 2 === 0 ? 'credit' : 'debit',
        cardLast4: month % 2 === 0 ? '1234' : null,
      });
    }
  }

  await prisma.expense.createMany({ data: expenseData, skipDuplicates: true });
  console.log('Created 3 months of expenses');

  // Create standard house expenses for months 1-3 of 2025
  const houseTypes = [
    { type: 'משכנתה', amount: 8000, dueDay: 1 },
    { type: 'חשמל', amount: 400, dueDay: 15 },
    { type: 'מים', amount: 200, dueDay: 20 },
    { type: 'אינטרנט', amount: 200, dueDay: 5 },
    { type: 'ארנונה', amount: 600, dueDay: 10 },
    { type: 'ביטוח', amount: 300, dueDay: 1 },
  ];

  const houseData = [];
  for (let month = 1; month <= 3; month++) {
    for (const h of houseTypes) {
      houseData.push({
        type: h.type,
        amount: h.amount,
        dueDay: h.dueDay,
        isRecurring: true,
        month,
        year: 2025,
        isPaid: month < 3,
        paidAt: month < 3 ? new Date(`2025-${String(month).padStart(2, '0')}-${String(h.dueDay).padStart(2, '0')}T00:00:00Z`) : null,
        notes: null,
      });
    }
  }

  await prisma.houseExpense.createMany({ data: houseData, skipDuplicates: true });
  console.log('Created house expenses');

  // Create savings goals
  const emergencyGoal = await prisma.savingsGoal.create({
    data: {
      name: 'קרן חירום',
      targetAmount: 50000.0,
      currentAmount: 12000.0,
      deadline: null,
    },
  });

  const vacationGoal = await prisma.savingsGoal.create({
    data: {
      name: 'חופשה',
      targetAmount: 15000.0,
      currentAmount: 3500.0,
      deadline: new Date('2025-08-01T00:00:00Z'),
    },
  });

  console.log('Created savings goals');

  // Create deposit history
  await prisma.savingsDeposit.createMany({
    data: [
      {
        goalId: emergencyGoal.id,
        amount: 2000.0,
        date: new Date('2025-01-01T00:00:00Z'),
        notes: 'הפקדה חודשית - ינואר',
      },
      {
        goalId: emergencyGoal.id,
        amount: 2000.0,
        date: new Date('2025-02-01T00:00:00Z'),
        notes: 'הפקדה חודשית - פברואר',
      },
      {
        goalId: emergencyGoal.id,
        amount: 2000.0,
        date: new Date('2025-03-01T00:00:00Z'),
        notes: 'הפקדה חודשית - מרץ',
      },
      {
        goalId: vacationGoal.id,
        amount: 1000.0,
        date: new Date('2025-01-01T00:00:00Z'),
        notes: 'חיסכון לחופשה - ינואר',
      },
      {
        goalId: vacationGoal.id,
        amount: 1000.0,
        date: new Date('2025-02-01T00:00:00Z'),
        notes: 'חיסכון לחופשה - פברואר',
      },
      {
        goalId: vacationGoal.id,
        amount: 1500.0,
        date: new Date('2025-03-01T00:00:00Z'),
        notes: 'חיסכון לחופשה - מרץ',
      },
    ],
  });

  console.log('Created savings deposit history');
  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

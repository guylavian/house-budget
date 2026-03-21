import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('log-node')();
import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { CategoryRule } from '../models/CategoryRule';
import { AppSettings } from '../models/AppSettings';
import { ScraperConfig } from '../models/ScraperConfig';
import { prisma } from '../lib/prisma';
import { classificationService } from '../services/classificationService';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const log = require('log').get('seed');

const HOUSE_CATEGORY_NAMES = ['שכר דירה','משכנתא','ועד/ארנונה','חשמל','מים','גז','תקשורת','ביטוח','הלוואה'];

const CATEGORIES = [
  { name: 'משכורת',             icon: '💰', color: '#10B981', type: 'income'   as const, sortOrder: 1,  isHouseCategory: false },
  { name: 'זיכויים',            icon: '↩️',  color: '#34D399', type: 'income'   as const, sortOrder: 2,  isHouseCategory: false },
  { name: 'קצבאות',             icon: '🏛️',  color: '#6EE7B7', type: 'income'   as const, sortOrder: 3,  isHouseCategory: false },
  { name: 'משכנתא',             icon: '🏠', color: '#F59E0B', type: 'expense'  as const, sortOrder: 10, isHouseCategory: true  },
  { name: 'ועד/ארנונה',         icon: '🏘️',  color: '#FBBF24', type: 'expense'  as const, sortOrder: 11, isHouseCategory: true  },
  { name: 'שכר דירה',          icon: '🏘️', color: '#F59E0B', type: 'expense'  as const, sortOrder: 12, isHouseCategory: true  },
  { name: 'חשמל',               icon: '⚡', color: '#FCD34D', type: 'expense'  as const, sortOrder: 13, isHouseCategory: true  },
  { name: 'מים',                icon: '💧', color: '#93C5FD', type: 'expense'  as const, sortOrder: 13, isHouseCategory: true  },
  { name: 'גז',                 icon: '🔥', color: '#FCA5A5', type: 'expense'  as const, sortOrder: 14, isHouseCategory: true  },
  { name: 'תקשורת',             icon: '📱', color: '#A78BFA', type: 'expense'  as const, sortOrder: 15, isHouseCategory: true  },
  { name: 'ביטוח',              icon: '🛡️',  color: '#6D28D9', type: 'expense'  as const, sortOrder: 16, isHouseCategory: true  },
  { name: 'הלוואה',             icon: '💸', color: '#F87171', type: 'expense'  as const, sortOrder: 17, isHouseCategory: true  },
  { name: 'סופרמרקט',          icon: '🛒', color: '#EF4444', type: 'expense'  as const, sortOrder: 20, isHouseCategory: false },
  { name: 'אוכל בחוץ',         icon: '🍽️',  color: '#F97316', type: 'expense'  as const, sortOrder: 21, isHouseCategory: false },
  { name: 'בריאות',             icon: '💊', color: '#EC4899', type: 'expense'  as const, sortOrder: 22, isHouseCategory: false },
  { name: 'דלק',                icon: '⛽', color: '#78716C', type: 'expense'  as const, sortOrder: 23, isHouseCategory: false },
  { name: 'תחבורה',             icon: '🚌', color: '#57534E', type: 'expense'  as const, sortOrder: 24, isHouseCategory: false },
  { name: 'ביגוד',              icon: '👕', color: '#0EA5E9', type: 'expense'  as const, sortOrder: 25, isHouseCategory: false },
  { name: 'בידור',              icon: '🎬', color: '#8B5CF6', type: 'expense'  as const, sortOrder: 26, isHouseCategory: false },
  { name: 'חינוך',              icon: '📚', color: '#3B82F6', type: 'expense'  as const, sortOrder: 27, isHouseCategory: false },
  { name: 'חיסכון',             icon: '🏦', color: '#059669', type: 'savings'  as const, sortOrder: 30, isHouseCategory: false },
  { name: 'קרן השתלמות',        icon: '📈', color: '#047857', type: 'savings'  as const, sortOrder: 31, isHouseCategory: false },
  { name: 'אשראי',              icon: '💳', color: '#6366F1', type: 'transfer' as const, sortOrder: 40, isHouseCategory: false },
  { name: 'משיכת מזומן',        icon: '💵', color: '#9CA3AF', type: 'transfer' as const, sortOrder: 41, isHouseCategory: false },
  { name: 'העברה ניטרלית',      icon: '↔️',  color: '#D1D5DB', type: 'transfer' as const, sortOrder: 42, isHouseCategory: false },
  { name: 'העברה בין חשבונות',  icon: '🔄', color: '#E5E7EB', type: 'transfer' as const, sortOrder: 43, isHouseCategory: false },
  { name: 'אחר',                icon: '📦', color: '#6B7280', type: 'expense'  as const, sortOrder: 99, isHouseCategory: false },
];

const RULE_DEFINITIONS = [
  { keywords: ['שכר דירה', 'שכ"ד', 'שכד', 'העברת שכר דירה'],                    category: 'שכר דירה',    type: 'expense'  as const, priority: 110 },
  { keywords: ['משכורת', 'שכר עבודה', 'מופ"ת קבע', 'תשלום שכר'],               category: 'משכורת',      type: 'income'   as const, priority: 100 },
  { keywords: ['זיכוי', 'החזר', 'refund'],                                        category: 'זיכויים',     type: 'income'   as const, priority: 90  },
  { keywords: ['ביטוח לאומי', 'קצבה', 'גמלה'],                                   category: 'קצבאות',      type: 'income'   as const, priority: 90  },
  { keywords: ['משכנתא', 'mortgage'],                                              category: 'משכנתא',      type: 'expense'  as const, priority: 95  },
  { keywords: ['ועד בית', 'ארנונה'],                                              category: 'ועד/ארנונה',  type: 'expense'  as const, priority: 90  },
  { keywords: ['חברת חשמל', 'חשמל', 'iec'],                                      category: 'חשמל',        type: 'expense'  as const, priority: 90  },
  { keywords: ['מים', 'תאגיד מים'],                                              category: 'מים',         type: 'expense'  as const, priority: 90  },
  { keywords: ['גז', 'סופרגז', 'פזגז'],                                          category: 'גז',          type: 'expense'  as const, priority: 90  },
  { keywords: ['בזק', 'hot', 'yes', 'partner', 'cellcom', '019', '012'],          category: 'תקשורת',      type: 'expense'  as const, priority: 85  },
  { keywords: ['כלל', 'מגדל', 'הראל', 'הפניקס', 'מנורה', 'ביטוח'],             category: 'ביטוח',       type: 'expense'  as const, priority: 80  },
  { keywords: ['רמי לוי', 'שופרסל', 'מגה', 'יינות ביתן', 'ויקטורי', 'אושר עד', 'חצי חינם', 'מחסני השוק'], category: 'סופרמרקט', type: 'expense' as const, priority: 75 },
  { keywords: ['wolt', 'ten bis', 'תן ביס', 'פיצה', 'סושי', 'מקדונלד', 'בורגר קינג', 'שווארמה', 'פלאפל', 'קפה'], category: 'אוכל בחוץ', type: 'expense' as const, priority: 70 },
  { keywords: ['סופר פארם', 'superpharm', 'נייעס', 'טבע פארם', 'מכבי', 'כללית', 'לאומית', 'קופת חולים', 'בית מרקחת'], category: 'בריאות', type: 'expense' as const, priority: 70 },
  { keywords: ['סונול', 'פז', 'דור אלון', 'תחנת דלק', 'gulf'],                   category: 'דלק',         type: 'expense'  as const, priority: 75  },
  { keywords: ['רב קו', 'אגד', 'רכבת', 'מטרו', 'uber', 'gett', 'yango'],        category: 'תחבורה',      type: 'expense'  as const, priority: 65  },
  { keywords: ['זארה', 'h&m', 'mango', 'fox', 'קסטרו', 'renuar', 'golf'],        category: 'ביגוד',       type: 'expense'  as const, priority: 60  },
  { keywords: ['netflix', 'spotify', 'apple', 'google play', 'סינמה', 'yes planet'], category: 'בידור',   type: 'expense'  as const, priority: 60  },
  { keywords: ['קופת גמל', 'קרן השתלמות', 'השתלמות', 'פנסיה', 'ביטוח מנהלים', 'אלטשולר', 'מיטב', 'פסגות'], category: 'חיסכון', type: 'savings' as const, priority: 85 },
  { keywords: ['סניפומט', 'משיכת מזומן', 'כספומט', 'atm'],                        category: 'משיכת מזומן',       type: 'transfer' as const, priority: 105 },
  { keywords: ['העברה מהחשבון', 'העברה לחשבון', 'העברה לאיש קשר', 'ביט', 'bit', 'פייבוקס', 'paybox'], category: 'העברה ניטרלית', type: 'transfer' as const, priority: 105 },
  { keywords: ['ח.נוסף', 'חשבון נוסף', 'התקבל מח.נוסף', 'העברה עצמית'],          category: 'העברה בין חשבונות', type: 'transfer' as const, priority: 105 },
  { keywords: ['הלוואה', 'תשלום הלוואה'],                                          category: 'הלוואה',            type: 'expense'  as const, priority: 88  },
];

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  log.notice('MongoDB connected');

  // --- Categories ---
  log.info('Seeding categories (upsert by name)...');
  const catIdMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { name: cat.name },
      { $setOnInsert: cat },
      { upsert: true, new: true }
    );
    catIdMap.set(cat.name, doc!._id.toString());
  }
  log.info('Upserted %d categories', catIdMap.size);

  // --- Category Rules ---
  log.info('Seeding category rules...');
  await CategoryRule.deleteMany({ source: { $ne: 'learned' } }); // keep learned rules
  const ruleDocuments = RULE_DEFINITIONS.map((def) => {
    const categoryId = catIdMap.get(def.category);
    if (!categoryId) throw new Error(`Category not found: ${def.category}`);
    return {
      keywords:   def.keywords,
      categoryId,
      type:       def.type,
      priority:   def.priority,
      isActive:   true,
    };
  });
  const insertedRules = await CategoryRule.insertMany(ruleDocuments);
  log.info('Inserted %d category rules', insertedRules.length);

  // --- AppSettings ---
  log.info('Seeding AppSettings...');
  await AppSettings.deleteMany({});
  await AppSettings.create({
    currency: 'ILS',
    locale:   'he-IL',
    alertThresholds: {
      largeExpense:   2000,
      savingsRateMin: 10,
      incomeDrop:     10,
    },
    bankSources: [
      { source: 'otsar_hahayal', label: 'אוצר החייל',  isEnabled: true },
      { source: 'isracard',      label: 'ישראכרט',      isEnabled: true },
      { source: 'max',           label: 'מקס',          isEnabled: true },
      { source: 'cal',           label: 'כאל',          isEnabled: true },
    ],
  });
  log.notice('AppSettings created');

  // --- ScraperConfig defaults (upsert — never overwrite user-modified docs) ---
  await ScraperConfig.bulkWrite([
    { updateOne: { filter: { source: 'otsar_hahayal' }, update: { $setOnInsert: {
      source: 'otsar_hahayal', companyId: 'otsarHahayal', label: 'אוצר החייל',
      credentialFields: ['username', 'password'], isEnabled: true, autoScrapeEnabled: false,
    }}, upsert: true }},
    { updateOne: { filter: { source: 'isracard' }, update: { $setOnInsert: {
      source: 'isracard', companyId: 'isracard', label: 'ישראכרט',
      credentialFields: ['id', 'card6Digits', 'password'], isEnabled: true, autoScrapeEnabled: false,
    }}, upsert: true }},
    { updateOne: { filter: { source: 'cal' }, update: { $setOnInsert: {
      source: 'cal', companyId: 'visaCal', label: 'כאל / דיינרס',
      credentialFields: ['username', 'password'], isEnabled: true, autoScrapeEnabled: false,
    }}, upsert: true }},
  ]);
  log.notice('ScraperConfig defaults upserted');

  // --- Migration: mark house categories in existing data ---
  const migrated = await Category.updateMany(
    { name: { $in: HOUSE_CATEGORY_NAMES } },
    { $set: { isHouseCategory: true } }
  );
  log.info('Migrated %d existing categories to isHouseCategory=true', migrated.modifiedCount);

  // --- Migration: reclassify existing transfer transactions ---
  const cashCat    = await Category.findOne({ name: 'משיכת מזומן' });
  const neutralCat = await Category.findOne({ name: 'העברה ניטרלית' });

  if (cashCat) {
    const r = await prisma.bankTransaction.updateMany({
      where: { description: { contains: 'סניפומט' }, type: { not: 'transfer' } },
      data: { type: 'transfer', categoryId: cashCat._id.toString(), confidence: 'auto' },
    });
    log.info('Reclassified %d cash withdrawal transactions', r.count);
  }
  if (neutralCat) {
    const r = await prisma.bankTransaction.updateMany({
      where: { description: { contains: 'העברה מהחשבון' }, type: { not: 'transfer' } },
      data: { type: 'transfer', categoryId: neutralCat._id.toString(), confidence: 'auto' },
    });
    log.info('Reclassified %d neutral transfer transactions', r.count);
  }

  // --- Migration: reclassify rent transactions wrongly typed as transfer ---
  const rentCat = await Category.findOne({ name: 'שכר דירה' });
  if (rentCat) {
    const r = await prisma.bankTransaction.updateMany({
      where: {
        OR: [
          { description: { contains: 'שכר דירה' } },
          { description: { contains: 'שכ"ד' } },
          { description: { contains: 'העברת שכר דירה' } },
        ],
        type: 'transfer',
      },
      data: { type: 'expense', categoryId: rentCat._id.toString(), confidence: 'auto' },
    });
    log.info('Reclassified %d rent transactions from transfer → expense', r.count);
  }

  // Reload classification rules in-process
  await classificationService.reloadRules();
  log.notice('Rules reloaded');

  // --- Reclassify all auto-classified transactions with fresh category IDs ---
  // This fixes broken categoryId references caused by category recreation.
  log.info('Reclassifying all auto-classified transactions...');
  const allTxns = await prisma.bankTransaction.findMany({
    where: { confidence: 'auto' },
  });
  let reclassified = 0;
  for (const txn of allTxns) {
    const result = classificationService.classify(txn.description);
    if (result.confidence === 'auto' && result.categoryId !== txn.categoryId) {
      await prisma.bankTransaction.update({
        where: { id: txn.id },
        data: { categoryId: result.categoryId, type: result.type },
      });
      reclassified++;
    }
  }
  log.notice('Reclassified %d auto transactions with updated category IDs', reclassified);

  await mongoose.disconnect();
  log.notice('Seed complete. MongoDB disconnected.');
}

seed().catch((err) => {
  log.error('Seed failed: %s', err);
  process.exit(1);
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createScraper, CompanyTypes } = require('@sergienko4/israeli-bank-scrapers');
import { ScraperConfig } from '../models/ScraperConfig';
import { prisma } from '../lib/prisma';
import { processScraperTransactions } from './importService';
import type { ScrapeResult } from './importService';

export type { ScrapeResult };

// DO NOT LOG credentials — they flow browser → HTTPS → memory → scraper → discarded
export interface ScrapeCredentials {
  [key: string]: string;
}

const COMPANY_TYPE_MAP: Record<string, string> = {
  otsar_hahayal: 'otsarHahayal',
  isracard:      'isracard',
  cal:           'visaCal',
  diners:        'visaCal',
  max:           'max',
};

export async function scrapeSource(
  source: string,
  credentials: ScrapeCredentials, // DO NOT LOG
  startDate: Date,
): Promise<ScrapeResult> {
  const companyKey = COMPANY_TYPE_MAP[source];
  if (!companyKey) throw new Error(`Unknown source: ${source}`);

  const scraper = createScraper({
    companyId:           CompanyTypes[companyKey],
    startDate,
    combineInstallments: false,
    showBrowser:         false,
    verbose:             false,
    puppeteerConfig: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await scraper.scrape(credentials); // DO NOT LOG credentials

  if (!result.success) {
    await ScraperConfig.updateOne(
      { source },
      { lastScrapedAt: new Date(), lastScrapedStatus: 'error', lastScrapedMessage: result.errorType ?? 'unknown' }
    );
    throw new Error(result.errorType ?? 'Scraping failed');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTxns = (result.accounts ?? []).flatMap((account: any) => account.txns ?? []);

  const importResult = await processScraperTransactions(allTxns, source, prisma);

  await ScraperConfig.updateOne(
    { source },
    {
      lastScrapedAt:       new Date(),
      lastScrapedStatus:   'success',
      lastScrapedMessage:  `${importResult.imported} תנועות חדשות`,
    }
  );

  return importResult;
}

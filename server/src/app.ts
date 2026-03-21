import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('log-node')();
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import log from './lib/logger';

import salaryRoutes from './routes/salary';
import expensesRoutes from './routes/expenses';
import houseRoutes from './routes/house';
import savingsRoutes from './routes/savings';
import dashboardRoutes from './routes/dashboard';
import exportRoutes from './routes/export';
import configRouter from './routes/config';
import bankRouter from './routes/bank';

import { connectMongo } from './lib/mongo';
import { classificationService } from './services/classificationService';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/salary', salaryRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/house', houseRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/config', configRouter);
app.use('/api/bank', bankRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

function validateEnv(): void {
  const required = ['DATABASE_URL', 'MONGODB_URI'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in values.');
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();
  await connectMongo();
  await classificationService.initialize();
  app.listen(PORT, () => {
    log.notice('Server running on http://localhost:%s', PORT);
  });
}

bootstrap().catch((err) => log.error(err));

export default app;

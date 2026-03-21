import mongoose from 'mongoose';
import log from './logger';

const dbLog = log.get('db');

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  dbLog.notice('MongoDB connected');
}

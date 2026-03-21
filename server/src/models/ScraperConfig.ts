import mongoose, { Schema, Document } from 'mongoose';

export interface IScraperConfig extends Document {
  source:               string;
  companyId:            string;
  label:                string;
  credentialFields:     string[];
  isEnabled:            boolean;
  lastScrapedAt?:       Date;
  lastScrapedStatus?:   'success' | 'error';
  lastScrapedMessage?:  string;
  autoScrapeEnabled:    boolean;
}

const ScraperConfigSchema = new Schema<IScraperConfig>({
  source:             { type: String, required: true, unique: true },
  companyId:          { type: String, required: true },
  label:              { type: String, required: true },
  credentialFields:   { type: [String], required: true },
  isEnabled:          { type: Boolean, default: true },
  lastScrapedAt:      { type: Date },
  lastScrapedStatus:  { type: String, enum: ['success', 'error'] },
  lastScrapedMessage: { type: String },
  autoScrapeEnabled:  { type: Boolean, default: false },
}, { timestamps: true });

export const ScraperConfig = mongoose.model<IScraperConfig>('ScraperConfig', ScraperConfigSchema);

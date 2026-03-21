import mongoose, { Schema, Document } from 'mongoose';

export interface IAppSettings extends Document {
  currency: string;
  locale: string;
  alertThresholds: {
    largeExpense: number;
    savingsRateMin: number;
    incomeDrop: number;
  };
  bankSources: {
    source: string;
    label: string;
    isEnabled: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>({
  currency: { type: String, default: 'ILS' },
  locale:   { type: String, default: 'he-IL' },
  alertThresholds: {
    largeExpense:   { type: Number, default: 2000 },
    savingsRateMin: { type: Number, default: 10 },
    incomeDrop:     { type: Number, default: 10 },
  },
  bankSources: [{
    source:    { type: String },
    label:     { type: String },
    isEnabled: { type: Boolean, default: true },
  }],
}, { timestamps: true });

export const AppSettings = mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

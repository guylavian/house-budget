import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryRule extends Document {
  keywords: string[];
  categoryId: string;
  type: 'expense' | 'income' | 'savings' | 'transfer';
  priority: number;
  isActive: boolean;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryRuleSchema = new Schema<ICategoryRule>({
  keywords:   { type: [String], required: true },
  categoryId: { type: String, required: true, ref: 'Category' },
  type:       { type: String, enum: ['expense','income','savings','transfer'], required: true },
  priority:   { type: Number, default: 0 },
  isActive:   { type: Boolean, default: true },
  source:     { type: String },
}, { timestamps: true });

CategoryRuleSchema.index({ priority: -1, isActive: 1 });

export const CategoryRule = mongoose.model<ICategoryRule>('CategoryRule', CategoryRuleSchema);

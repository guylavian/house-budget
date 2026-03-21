import mongoose, { Schema, Document } from 'mongoose';

export interface IBudgetLimit extends Document {
  categoryId: string;
  amount: number;
  isRecurring: boolean;
  month?: number;
  year?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetLimitSchema = new Schema<IBudgetLimit>({
  categoryId:  { type: String, required: true, ref: 'Category' },
  amount:      { type: Number, required: true, min: 0 },
  isRecurring: { type: Boolean, default: true },
  month:       { type: Number, min: 1, max: 12 },
  year:        { type: Number },
}, { timestamps: true });

export const BudgetLimit = mongoose.model<IBudgetLimit>('BudgetLimit', BudgetLimitSchema);

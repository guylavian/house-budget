import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'savings' | 'transfer';
  budgetAmount?: number;
  isArchived: boolean;
  isHouseCategory: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name:            { type: String, required: true, unique: true, trim: true },
  icon:            { type: String, default: '📦' },
  color:           { type: String, default: '#6B7280' },
  type:            { type: String, enum: ['expense','income','savings','transfer'], required: true },
  budgetAmount:    { type: Number, min: 0 },
  isArchived:      { type: Boolean, default: false },
  isHouseCategory: { type: Boolean, default: false },
  sortOrder:       { type: Number, default: 0 },
}, { timestamps: true });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

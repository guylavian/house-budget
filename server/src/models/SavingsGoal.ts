import mongoose, { Schema, Document } from 'mongoose';

export interface ISavingsGoal extends Document {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
  color: string;
  icon: string;
  isCompleted: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SavingsGoalSchema = new Schema<ISavingsGoal>({
  name:          { type: String, required: true, trim: true },
  targetAmount:  { type: Number, required: true, min: 0 },
  currentAmount: { type: Number, default: 0, min: 0 },
  deadline:      { type: Date },
  color:         { type: String, default: '#10B981' },
  icon:          { type: String, default: '🎯' },
  isCompleted:   { type: Boolean, default: false },
  notes:         { type: String },
}, { timestamps: true });

SavingsGoalSchema.virtual('progressPct').get(function() {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, (this.currentAmount / this.targetAmount) * 100);
});

export const SavingsGoal = mongoose.model<ISavingsGoal>('SavingsGoal', SavingsGoalSchema);

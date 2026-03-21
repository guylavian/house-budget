import mongoose, { Schema, Document } from 'mongoose';

export interface IHouseholdMember extends Document {
  name: string;
  role: 'primary' | 'partner' | 'other';
  avatar?: string;
  salaryTarget?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HouseholdMemberSchema = new Schema<IHouseholdMember>({
  name:         { type: String, required: true, unique: true, trim: true },
  role:         { type: String, enum: ['primary','partner','other'], required: true },
  avatar:       { type: String, default: '👤' },
  salaryTarget: { type: Number, min: 0 },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

export const HouseholdMember = mongoose.model<IHouseholdMember>('HouseholdMember', HouseholdMemberSchema);

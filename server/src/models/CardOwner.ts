import mongoose, { Schema, Document } from 'mongoose';

export interface ICardOwner extends Document {
  source:     string;   // 'isracard' | 'diners' | 'max' | 'otsar_hahayal'
  cardLast4:  string;   // '4 digit string'
  ownerName:  string;   // display name, e.g. 'מיטל'
}

const CardOwnerSchema = new Schema<ICardOwner>({
  source:    { type: String, required: true },
  cardLast4: { type: String, required: true },
  ownerName: { type: String, required: true },
}, { timestamps: true });

CardOwnerSchema.index({ source: 1, cardLast4: 1 }, { unique: true });

export const CardOwner = mongoose.model<ICardOwner>('CardOwner', CardOwnerSchema);

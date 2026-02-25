import mongoose, { Schema, type Document } from 'mongoose';

export interface RunStats {
  fetched: number;
  deduplicated: number;
  kept: number;
  discarded: number;
}

export interface IRun extends Document {
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  sources: string[];
  stats: RunStats;
}

const RunSchema = new Schema<IRun>({
  startedAt: { type: Date, required: true, default: () => new Date() },
  completedAt: { type: Date },
  status: { type: String, enum: ['running', 'completed', 'failed'], required: true, default: 'running' },
  error: { type: String },
  sources: { type: [String], default: [] },
  stats: {
    fetched: { type: Number, default: 0 },
    deduplicated: { type: Number, default: 0 },
    kept: { type: Number, default: 0 },
    discarded: { type: Number, default: 0 },
  },
});

export const Run = mongoose.model<IRun>('Run', RunSchema);

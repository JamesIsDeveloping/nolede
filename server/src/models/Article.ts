import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ArticleSource {
  name: string;
  url: string;
}

export interface IArticle extends Document {
  runId: Types.ObjectId;
  sources: ArticleSource[];
  title: string | null;
  publishedAt: Date;
  headline: string | null;
  summary: string;
  detail: string | null;
  category: string;
  importance: number;
  aiMerged: boolean;
  createdAt: Date;
}

const ArticleSourceSchema = new Schema<ArticleSource>(
  { name: { type: String, required: true }, url: { type: String, required: true } },
  { _id: false },
);

const ArticleSchema = new Schema<IArticle>(
  {
    runId: { type: Schema.Types.ObjectId, ref: 'Run', required: true, index: true },
    sources: { type: [ArticleSourceSchema], required: true },
    title: { type: String, default: null },
    publishedAt: { type: Date, required: true },
    headline: { type: String, default: null },
    summary: { type: String, required: true },
    detail: { type: String, default: null },
    category: { type: String, required: true, default: 'local' },
    importance: { type: Number, required: true, default: 5 },
    aiMerged: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Index for filtering by source name inside the sources array
ArticleSchema.index({ 'sources.name': 1 });

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);

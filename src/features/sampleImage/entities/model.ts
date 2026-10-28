// src/features/sampleImage/entities/model.ts

import type { Sample } from "@/features/sample/entities/model";

export type SampleImage = {
  id: string;
  sample_id: string;
  file: string;
  sort_order: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * リレーション展開済みの SampleImage 型。
 * withRelations: true オプション使用時に返される。
 */
export type SampleImageWithRelations = SampleImage & {
  /** belongsTo: サンプル */
  sample?: Sample | null;
};

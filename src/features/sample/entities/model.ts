// src/features/sample/entities/model.ts

import type { SampleCategory } from "@/features/sampleCategory/entities/model";
import type { SampleTag } from "@/features/sampleTag/entities/model";

export type Sample = {
  id: string;
  sample_category_id: string | null;
  sample_tag_ids?: string[];
  name: string;
  number: number | null;
  rich_number: number | null;
  switch: boolean | null;
  radio: boolean | null;
  select: 'apple' | 'orange' | 'berry' | null;
  multi_select: string[];
  sale_start_at: Date | null;
  date: string | null;
  time: string | null;
  main_image: string | null;
  sub_image: string | null;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * リレーション展開済みの Sample 型。
 * withRelations: true オプション使用時に返される。
 */
export type SampleWithRelations = Sample & {
  /** belongsTo: サンプルカテゴリ */
  sample_category?: SampleCategory | null;
  /** belongsToMany: サンプルタグ配列 */
  sample_tags?: SampleTag[];
};

/**
 * カウント付きの Sample 型。
 * withCount: true オプション使用時に返される。
 */
export type SampleWithCount = Sample & {
  _count: {
    /** サンプルタグの数 */
    sample_tags: number;
  };
};

/**
 * リレーション展開 + カウント付きの Sample 型。
 * withRelations: true, withCount: true オプション使用時に返される。
 */
export type SampleWithRelationsAndCount = SampleWithRelations & SampleWithCount;

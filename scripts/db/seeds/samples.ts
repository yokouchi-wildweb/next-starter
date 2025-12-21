// scripts/db/seeds/samples.ts

import { sampleService } from "@/features/sample/services/server/sampleService";
import type { SeedSampleCategories } from "./sampleCategories";
import type { SeedSampleTags } from "./sampleTags";

type SeedSamplesParams = {
  categories: SeedSampleCategories;
  tags: SeedSampleTags;
};

export async function seedSamples({ categories, tags }: SeedSamplesParams): Promise<void> {
  console.log("  → サンプルデータを作成中...");

  const samples = [
    {
      name: "季節限定ジャム",
      sample_category_id: categories.categoryA.id,
      sample_tag_ids: [tags.tagA.id, tags.tagB.id],
      number: 24,
      rich_number: 48,
      select: "apple" as const,
      multi_select: ["apple", "orange"],
      description: "青森産りんごを使用した季節限定ジャム",
    },
    {
      name: "クラフトドリンク",
      sample_category_id: categories.categoryB.id,
      sample_tag_ids: [tags.tagB.id],
      number: 120,
      rich_number: 180,
      select: "orange" as const,
      multi_select: ["orange", "cherry"],
      description: "シトラスベースの微炭酸ドリンク",
    },
    {
      name: "フリーズドライベリー",
      sample_category_id: categories.categoryC.id,
      sample_tag_ids: [tags.tagC.id],
      number: 45,
      rich_number: 60,
      select: "berry" as const,
      multi_select: ["apple"],
      description: "デザートトッピング向けベリー",
    },
    {
      name: "スパイスティーセット",
      sample_category_id: categories.categoryA.id,
      sample_tag_ids: [tags.tagA.id, tags.tagC.id],
      number: 80,
      rich_number: 100,
      select: "apple" as const,
      multi_select: [],
      description: "チャイ用ブレンドの飲み比べセット",
    },
  ];

  for (const sample of samples) {
    // sampleServiceを使ってbelongsToManyを自動同期
    await sampleService.create(sample);
    console.log(`    ✓ ${sample.name}`);
  }
}

// scripts/db/seed/data/sampleTags.ts

import { db } from "@/lib/drizzle";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";

export type SeedSampleTags = {
  tagA: typeof SampleTagTable.$inferSelect;
  tagB: typeof SampleTagTable.$inferSelect;
  tagC: typeof SampleTagTable.$inferSelect;
};

const SAMPLE_TAGS = [
  { key: "tagA", name: "新商品", description: "新しく追加された商品" },
  { key: "tagB", name: "人気", description: "人気の高い商品" },
  { key: "tagC", name: "セール", description: "セール対象商品" },
] as const;

export async function seedSampleTags(): Promise<SeedSampleTags> {
  console.log("  → サンプルタグを作成中...");

  const result: Record<string, typeof SampleTagTable.$inferSelect> = {};

  for (const tag of SAMPLE_TAGS) {
    const [created] = await db
      .insert(SampleTagTable)
      .values({
        name: tag.name,
        description: tag.description,
      })
      .returning();

    result[tag.key] = created;
    console.log(`    ✓ ${tag.name}`);
  }

  return result as SeedSampleTags;
}

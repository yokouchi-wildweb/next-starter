// scripts/db/seed/data/sampleCategories.ts

import { db } from "@/lib/drizzle";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";

export type SeedSampleCategories = {
  categoryA: typeof SampleCategoryTable.$inferSelect;
  categoryB: typeof SampleCategoryTable.$inferSelect;
  categoryC: typeof SampleCategoryTable.$inferSelect;
};

const SAMPLE_CATEGORIES = [
  { key: "categoryA", name: "カテゴリA", description: "試作用カテゴリA" },
  { key: "categoryB", name: "カテゴリB", description: "試作用カテゴリB" },
  { key: "categoryC", name: "カテゴリC", description: "試作用カテゴリC" },
] as const;

export async function seedSampleCategories(): Promise<SeedSampleCategories> {
  console.log("  → サンプルカテゴリを作成中...");

  const result: Record<string, typeof SampleCategoryTable.$inferSelect> = {};

  for (const category of SAMPLE_CATEGORIES) {
    const [created] = await db
      .insert(SampleCategoryTable)
      .values({
        name: category.name,
        description: category.description,
      })
      .returning();

    result[category.key] = created;
    console.log(`    ✓ ${category.name}`);
  }

  return result as SeedSampleCategories;
}

// scripts/db/seeds/sampleCategories.ts

import { eq } from "drizzle-orm";
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
      .onConflictDoNothing()
      .returning();

    if (created) {
      result[category.key] = created;
      console.log(`    ✓ ${category.name}`);
    } else {
      // 既存の場合は取得
      const [existing] = await db
        .select()
        .from(SampleCategoryTable)
        .where(eq(SampleCategoryTable.name, category.name))
        .limit(1);
      if (existing) {
        result[category.key] = existing;
        console.log(`    ✓ ${category.name} (既存)`);
      }
    }
  }

  return result as SeedSampleCategories;
}

// src/features/sampleCategory/seed.ts — sampleCategory のシード(pnpm ops db seed、書き方: src/lib/seed/README.md)
// 何度打っても同じ(name で探す)。
import "server-only";

import { defineSeed } from "@/lib/seed";

export const seed = defineSeed({
  tables: {
    sample_categories: [
      { $key: "categoryA", $unique: ["name"], name: "カテゴリA", description: "試作用カテゴリA" },
      { $key: "categoryB", $unique: ["name"], name: "カテゴリB", description: "試作用カテゴリB" },
      { $key: "categoryC", $unique: ["name"], name: "カテゴリC", description: "試作用カテゴリC" },
    ],
  },
});

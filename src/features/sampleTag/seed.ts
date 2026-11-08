// src/features/sampleTag/seed.ts — sampleTag のシード(pnpm ops db seed、書き方: src/lib/seed/README.md)
// 何度打っても同じ(name で探す)。
import "server-only";

import { defineSeed } from "@/lib/seed";

export const seed = defineSeed({
  tables: {
    sample_tags: [
      { $key: "tagA", $unique: ["name"], name: "新商品", description: "新しく追加された商品" },
      { $key: "tagB", $unique: ["name"], name: "人気", description: "人気の高い商品" },
      { $key: "tagC", $unique: ["name"], name: "セール", description: "セール対象商品" },
    ],
  },
});

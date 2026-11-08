// src/features/sampleImage/seed.ts — sampleImage のシード(pnpm ops db seed、書き方: src/lib/seed/README.md)
// 中身はデータだけ(入れるのは sampleImage のサービス)。関係先は ref(<ドメイン>, <$key>)、そのドメインは after に書く。
import "server-only";

import { defineSeed } from "@/lib/seed";

export const seed = defineSeed({
  // after: ["<先に入れるドメイン>"],
  tables: {
    sample_images: [
      // 列: file, sort_order, sample_id
      // 例(何度打っても同じにするなら $unique に探す列を書く): { $key: "example1", $unique: ["file"], file: "…" },
    ],
  },
});

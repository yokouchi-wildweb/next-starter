// src/features/sample/seed.ts — sample のシード(pnpm ops db seed、書き方: src/lib/seed/README.md)
// タグとカテゴリを先に入れ、ref で指す(belongsToMany の sample_tag_ids は sampleService.create が同期する)。何度打っても同じ(name で探す)。
import "server-only";

import { defineSeed, ref } from "@/lib/seed";

export const seed = defineSeed({
  after: ["sampleTag", "sampleCategory"],
  tables: {
    samples: [
      {
        $key: "jam",
        $unique: ["name"],
        name: "季節限定ジャム",
        sample_category_id: ref("sampleCategory", "categoryA"),
        sample_tag_ids: [ref("sampleTag", "tagA"), ref("sampleTag", "tagB")],
        number: 24,
        rich_number: 48,
        select: "apple",
        multi_select: ["apple", "orange"],
        description: "青森産りんごを使用した季節限定ジャム",
      },
      {
        $key: "drink",
        $unique: ["name"],
        name: "クラフトドリンク",
        sample_category_id: ref("sampleCategory", "categoryB"),
        sample_tag_ids: [ref("sampleTag", "tagB")],
        number: 120,
        rich_number: 180,
        select: "orange",
        multi_select: ["orange", "cherry"],
        description: "シトラスベースの微炭酸ドリンク",
      },
      {
        $key: "berry",
        $unique: ["name"],
        name: "フリーズドライベリー",
        sample_category_id: ref("sampleCategory", "categoryC"),
        sample_tag_ids: [ref("sampleTag", "tagC")],
        number: 45,
        rich_number: 60,
        select: "berry",
        multi_select: ["apple"],
        description: "デザートトッピング向けベリー",
      },
      {
        $key: "tea",
        $unique: ["name"],
        name: "スパイスティーセット",
        sample_category_id: ref("sampleCategory", "categoryA"),
        sample_tag_ids: [ref("sampleTag", "tagA"), ref("sampleTag", "tagC")],
        number: 80,
        rich_number: 100,
        select: "apple",
        multi_select: [],
        description: "チャイ用ブレンドの飲み比べセット",
      },
    ],
  },
});

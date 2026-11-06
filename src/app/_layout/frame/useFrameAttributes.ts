"use client";

// 枠の表の共通の読み手(利用者の枠・管理の枠の根が自分の表を渡して呼ぶ)。今のルート(枠の layout の下の segment)に
// 当たる表の行を、外枠に付ける属性にする。表 = <枠の根>/_layout/extensions/frameTable.ts(pnpm generate extensions が
// 枠の宣言 frame.default.ts / frame.ts から生成)。照合 = matchFrame(当たる 1 行)。属性を読む CSS = src/styles/core/frame.css。
// "use client" の hook なので index.ts からは re-export しない(server の宣言・表が index を読んでも client を引き込まない)。仕組み: ./README.md

import { useSelectedLayoutSegments } from "next/navigation";

import { matchFrame } from "./resolve.mjs";
import type { FrameAttributes, FrameTable } from "./types";

export function useFrameAttributes(table: FrameTable): FrameAttributes {
  // app router の外(テストの静的描画など)では null が返る
  const segments: readonly string[] | null = useSelectedLayoutSegments();
  const { hide, fill } = matchFrame(segments ?? [], table);
  return {
    ...(hide.length > 0 ? { "data-frame-hide": hide.join(" ") } : {}),
    ...(fill ? { "data-frame-fill": "" as const } : {}),
  };
}

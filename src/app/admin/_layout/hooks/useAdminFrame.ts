"use client";

// 管理の枠の表の読み手(利用者の枠の (user)/_layout/hooks/useUserFrame.ts と同じ形)。今のルート(src/app/admin の layout の下の segment)に
// 当たる表の行を、外枠(AdminLayout)に付ける属性にする。
// 表 = ../extensions/frameTable.ts(pnpm extensions:generate が src/app/admin の下の枠の宣言 frame.default.ts / frame.ts から生成)。照合 = matchFrame(当たる 1 行)。
// 属性を読む CSS = src/styles/_base/frame.css。仕組み: src/app/_layout/frame/README.md

import { useSelectedLayoutSegments } from "next/navigation";

import { matchFrame } from "@/app/_layout/frame";

import { frameTable } from "../extensions/frameTable";

/** 外枠に付ける属性。data-frame-hide = 隠す印 `admin-<部位>-<sp|pc>` の空白区切り、data-frame-fill = 本文が残りの高さを埋める */
export type AdminFrameAttributes = {
  readonly "data-frame-hide"?: string;
  readonly "data-frame-fill"?: "";
};

export function useAdminFrame(): AdminFrameAttributes {
  // app router の外(テストの静的描画など)では null が返る
  const segments: readonly string[] | null = useSelectedLayoutSegments();
  const { hide, fill } = matchFrame(segments ?? [], frameTable);
  return {
    ...(hide.length > 0 ? { "data-frame-hide": hide.join(" ") } : {}),
    ...(fill ? { "data-frame-fill": "" as const } : {}),
  };
}

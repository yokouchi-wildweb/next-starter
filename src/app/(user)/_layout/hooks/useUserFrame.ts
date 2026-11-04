"use client";

// 利用者の枠の表の読み手。今のルート(枠の layout の下の segment)に当たる表の行を、外枠に付ける属性にする。
// 表 = ../extensions/frameTable.ts(pnpm extensions:generate が各ルートの frame.ts から生成)。照合 = matchFrame(当たる 1 行)。
// 属性を読む CSS = src/styles/_base/frame.css。仕組み: src/app/_layout/frame/README.md

import { useSelectedLayoutSegments } from "next/navigation";

import { matchFrame } from "@/app/_layout/frame";

import { frameTable } from "../extensions/frameTable";

/** 外枠に付ける属性。data-frame-hide = 隠す印 `<部位>-<sp|pc>` の空白区切り、data-frame-fill = 本文が画面の高さを埋める */
export type UserFrameAttributes = {
  readonly "data-frame-hide"?: string;
  readonly "data-frame-fill"?: "";
};

export function useUserFrame(): UserFrameAttributes {
  // app router の外(テストの静的描画など)では null が返る
  const segments: readonly string[] | null = useSelectedLayoutSegments();
  const { hide, fill } = matchFrame(segments ?? [], frameTable);
  return {
    ...(hide.length > 0 ? { "data-frame-hide": hide.join(" ") } : {}),
    ...(fill ? { "data-frame-fill": "" as const } : {}),
  };
}

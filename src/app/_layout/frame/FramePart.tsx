"use client";

// 枠の部位の包み(利用者の枠の根が、隠しうる差し込み口と本文の包みごとに使う)。今のルートの宣言(枠の表の当たる 1 行)を
// 自分の要素の印にして子を描く: data-frame-hide = 隠す印 `<部位>-<sp|pc>` の空白区切り / data-frame-fill = 本文が画面の高さを埋める。
// 印を読む CSS = src/styles/core/frame.css(部位は自分の印の下の data-slot で隠れ、外枠の変数と fill は外枠の :has() が読む)。
// 枠の根は URL を読まない(殻に入る)。判定は部位ごとにこの部品の中で読むので、ルートの段が request で決まる時([id] 等)も
// 部位と判定が同じ塊で届く(Suspense の内側、ちらつかない)。差し込み口に渡した要素が request を読んでも、この Suspense が受ける。
// "use client" の部品なので index.ts からは re-export しない(useFrameAttributes と同じ)。仕組み: ./README.md

import { type ReactNode, Suspense } from "react";

import { Block } from "@/components/Layout/Block";

import type { FrameTable } from "./types";
import { useFrameAttributes } from "./useFrameAttributes";

export function FramePart({ table, children }: Readonly<{ table: FrameTable; children: ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <FramePartMarks table={table}>{children}</FramePartMarks>
    </Suspense>
  );
}

function FramePartMarks({ table, children }: Readonly<{ table: FrameTable; children: ReactNode }>) {
  const marks = useFrameAttributes(table);
  // display: contents = 包みは箱を作らない(部位の並び・高さの鎖は今のまま)
  return (
    <Block data-frame-part="" {...marks} className="contents">
      {children}
    </Block>
  );
}

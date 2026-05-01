// src/features/core/purchaseRequest/components/BankTransferInstructionPage/SaveBookmarkModal/ActionRow.tsx
//
// 共有アクション 1 行ぶんのカード型ボタン。
// アイコン（カラーアクセント付き）+ ラベル + 補足説明 + 右矢印で構成し、
// 「メールで送る」「LINE で送る」「その他で共有」等の共有導線を統一フォーマットで並べる。
// button 要素をそのまま装飾する形にしているのは、リスト行にフィットする
// 大型タッチ領域 (56px+) を Form/Button では表現しきれないため。

"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";

type Props = {
  /** 行頭に表示するアイコン要素 */
  icon: ReactNode;
  /** アイコン背景円に当てる Tailwind クラス（例: "bg-[#06C755] text-white"） */
  iconAccent?: string;
  /** メインラベル */
  label: string;
  /** 補足説明（省略可） */
  description?: string;
  onClick: () => void;
};

export function ActionRow({ icon, iconAccent, label, description, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg border border-border bg-card transition-colors hover:bg-accent/30 active:bg-accent/50"
    >
      <Flex align="center" gap="xs" className="px-3 py-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconAccent ?? "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {icon}
        </span>
        <Stack space={0.5} className="flex-1 text-left">
          <Span weight="semiBold" size="sm">
            {label}
          </Span>
          {description ? (
            <Span size="xs" tone="muted">
              {description}
            </Span>
          ) : null}
        </Stack>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Flex>
    </button>
  );
}

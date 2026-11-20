// src/features/core/purchaseRequest/components/BankTransferInstruction/SaveBookmarkModal/ActionRow.tsx
//
// 共有アクション 1 行ぶんのカード型ボタン。
// アイコン（カラーアクセント付き）+ ラベル + 補足説明 + 右矢印で構成し、
// 「メールで送る」「LINE で送る」「その他で共有」等の共有導線を統一フォーマットで並べる。
// Form/Button の variant / size none に行の形を className で付ける(56px+ の大きな押し口。
// Button の土台の inline-flex・折り返さない・文字の大きさと太さは block / whitespace-normal / 継ぐ値で戻す)。

"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { InBlock } from "@/components/Layout/InBlock";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
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
    <Button
      type="button"
      variant="none"
      size="none"
      iconSizing="none"
      propagateClick
      onClick={onClick}
      className="group block w-full whitespace-normal rounded-lg border border-border bg-card text-[length:inherit] font-normal transition-colors hover:bg-accent/30 active:bg-accent/50"
    >
      <Flex align="center" gap="xs" className="px-3 py-3">
        <InBlock
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconAccent ?? "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {icon}
        </InBlock>
        <Stack className="gap-0.5 flex-1 text-left">
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
    </Button>
  );
}

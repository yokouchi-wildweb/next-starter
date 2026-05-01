// src/features/core/bankTransferReview/components/ActiveTransferBanner/index.tsx
//
// ウォレットトップに表示する「進行中の自社銀行振込」のお知らせバナー。
// active が null の場合（=進行中の振込がない通常状態）は何も描画しない。
//
// 想定するライフサイクル:
//   1. ユーザーが「銀行振込」で購入を開始 → active.status = "pre_submit"
//   2. 振込明細を申告 → 即時モードなら completePurchase で完了画面へ自動遷移
//      確認モードなら active.status = "pending_review" でこのバナー継続
//   3. 完了 / 失効で active = null に戻りバナー非表示
//
// CTA は active.redirectUrl をそのまま踏む（status に応じた適切な遷移先を
// サーバー側が返してくれるため、UI 側は分岐ロジックを持たない）。

"use client";

import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";

import { useActiveBankTransfer } from "../../hooks/useActiveBankTransfer";

/**
 * status 別に表示するメッセージ。
 * - pre_submit: 購入は開始しているが振込明細未申告（最も一般的なケース）
 * - pending_review: 申告済み・管理者確認待ち（autoComplete=false 運用時のみ発生）
 */
const STATUS_MESSAGES: Record<"pre_submit" | "pending_review", { heading: string; description: string }> = {
  pre_submit: {
    heading: "お振込みが未完了のご購入があります",
    description: "振込画面から手続きを完了してください。",
  },
  pending_review: {
    heading: "お振込みのご確認中のご購入があります",
    description: "管理者の確認後に通貨が付与されます。",
  },
};

export function ActiveTransferBanner() {
  const { data, error } = useActiveBankTransfer();

  // エラー / 未取得 / 進行中振込なし → 描画しない（サイレントフェイル）
  if (error || !data || data.active === null) {
    return null;
  }

  const { active } = data;
  const messages = STATUS_MESSAGES[active.status];

  return (
    <Link href={active.redirectUrl} className="block">
      <Block
        padding="md"
        className="rounded-lg border-2 border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10"
      >
        <Flex align="center" gap="sm">
          {/* アイコン円バッジ */}
          <Block className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Clock className="h-4 w-4 text-primary" strokeWidth={2.5} />
          </Block>

          {/* メッセージ */}
          <Stack space={0.5} className="min-w-0 flex-1">
            <Span weight="semiBold" size="sm" tone="primary">
              {messages.heading}
            </Span>
            <Para size="xs" tone="muted">
              {messages.description}
            </Para>
          </Stack>

          {/* シェブロン（クリック誘導） */}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Flex>
      </Block>
    </Link>
  );
}

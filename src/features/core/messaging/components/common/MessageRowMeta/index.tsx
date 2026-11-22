// src/features/core/messaging/components/common/MessageRowMeta/index.tsx
// 部品(props だけ): 管理の一覧の行(送信一覧・テンプレート・テキストの編集)の共通の小さな表示。どの一覧も同じ情報は同じ形で出す:
// - 行の形 = 1 段目: 状態の札・名前・印の札 … 右に日時(RowDateMeta)/ 2 段目: 印つきの組(RowMetaItem)を並べる
// - RowMetaItem: 印(lucide)+ 中身。印の意味は aria-label で読み上げる
// - KindCategoryMeta: Tag の印 + 「種別 › カテゴリー」(片方だけでも出す)
// - ChannelsMeta: Send の印 + 送信方法ごとの札
// - RowDateMeta: 時計の印 + 日時(1 段目の右端)

"use client";

import type { ReactNode } from "react";
import { ChevronRight, Clock, Send, Tag, type LucideIcon } from "lucide-react";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

/** 2 段目の 1 つの組(印 + 中身) */
export function RowMetaItem({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <Flex align="center" gap="xs" className="min-w-0" aria-label={label} data-slot="row-meta">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </Flex>
  );
}

/** 種別 › カテゴリー(どちらも無ければ出さない) */
export function KindCategoryMeta({ kindLabel, categoryLabel }: { kindLabel?: string | null; categoryLabel?: string | null }) {
  if (!kindLabel && !categoryLabel) return null;
  return (
    <RowMetaItem icon={Tag} label="種別とカテゴリー">
      {kindLabel ? <Span size="sm">{kindLabel}</Span> : null}
      {kindLabel && categoryLabel ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      {categoryLabel ? <Span size="sm">{categoryLabel}</Span> : null}
    </RowMetaItem>
  );
}

/** 送信方法の札(無ければ出さない) */
export function ChannelsMeta({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return null;
  return (
    <RowMetaItem icon={Send} label="送信方法">
      <Flex align="center" gap="xs" wrap="wrap">
        {labels.map((label) => (
          <SoftBadge key={label} variant="outline" size="sm">
            {label}
          </SoftBadge>
        ))}
      </Flex>
    </RowMetaItem>
  );
}

/** 日時(1 段目の右端。text は呼び手が整えた日時の文字) */
export function RowDateMeta({ text, label }: { text: string; label: string }) {
  return (
    <Flex align="center" gap="xs" className="shrink-0" aria-label={label} data-slot="row-date">
      <Clock className="size-3.5 text-muted-foreground" aria-hidden />
      <Span size="sm" tone="muted" className="tabular-nums">
        {text}
      </Span>
    </Flex>
  );
}

// src/features/core/messaging/components/common/InboxItemRow/index.tsx
// 部品(props だけ): 受け取り箱の 1 行(未読の印・題・本文の頭・公開の日時)。押すと onOpen(item)。
// 題が無い行は「お知らせ」。本文は 2 行で切る(全文は InboxItemDetail)

"use client";

import { Button } from "@/components/Form/Button/Button";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";

import type { InboxItemDto } from "@/features/core/messaging/services/client/inboxClient";

import { InboxUnreadMark } from "../InboxUnreadMark";

/** 公開の日時の表示(ja-JP)。読めない値は空 */
export function formatInboxDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ja-JP");
}

export type InboxItemRowProps = {
  item: InboxItemDto;
  onOpen: (item: InboxItemDto) => void;
  /** 題が無い行の見出し(既定「お知らせ」) */
  fallbackTitle?: string;
  className?: string;
};

export function InboxItemRow({ item, onOpen, fallbackTitle = "お知らせ", className }: InboxItemRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onOpen(item)}
      className={cn("h-auto w-full items-start justify-start gap-3 whitespace-normal p-3 text-left", className)}
    >
      <Span className="mt-2 flex w-2 shrink-0 justify-center">
        <InboxUnreadMark unread={!item.read} />
      </Span>
      <Span className="flex min-w-0 flex-1 flex-col gap-1">
        <Span weight={item.read ? "normal" : "bold"} className="truncate">
          {item.title ?? fallbackTitle}
        </Span>
        <Span size="sm" tone="muted" className="line-clamp-2 break-words">
          {item.body}
        </Span>
        <Span size="xs" tone="muted">
          {formatInboxDate(item.publishedAt)}
        </Span>
      </Span>
    </Button>
  );
}

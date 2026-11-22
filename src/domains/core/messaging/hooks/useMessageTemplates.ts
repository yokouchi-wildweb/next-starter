"use client";

// src/domains/core/messaging/hooks/useMessageTemplates.ts
//
// 管理: 保存されたテンプレートの一覧(無限スクロール、カーソルのモード)。種別・文字の検索が変われば先頭から取り直す

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { listMessageTemplates, type AdminTemplateSummary } from "../services/client/templateClient";

const DEFAULT_LIMIT = 50;

export type UseMessageTemplatesOptions = {
  /** 種別で絞る(その種別のカテゴリーとシステムテンプレート、D135。省略 = 全部) */
  kind?: string;
  /** 名前か文面の文字で探す(1〜100 字。空・省略 = 探さない) */
  q?: string;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

export function useMessageTemplates(options: UseMessageTemplatesOptions = {}) {
  const { kind, q, limit = DEFAULT_LIMIT, enabled, observerOptions } = options;
  return useInfiniteScrollQuery<AdminTemplateSummary, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => listMessageTemplates({ kind, q: q || undefined, cursor, limit: pageLimit }),
    limit,
    enabled,
    observerOptions,
    deps: [kind, q, limit],
  });
}

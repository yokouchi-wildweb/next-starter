"use client";

// src/features/core/messaging/hooks/useMessageTemplates.ts
//
// 管理: 保存されたテンプレートの一覧(無限スクロール、カーソルのモード)。状態・種別が変われば先頭から取り直す

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { listMessageTemplates, type AdminTemplateSummary } from "../services/client/templateClient";

const DEFAULT_LIMIT = 50;

export type UseMessageTemplatesOptions = {
  /** published | archived(省略 = 全部) */
  status?: string;
  /** 種別で絞る(その種別のカテゴリーとシステムテンプレート、D135。省略 = 全部) */
  kind?: string;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

export function useMessageTemplates(options: UseMessageTemplatesOptions = {}) {
  const { status, kind, limit = DEFAULT_LIMIT, enabled, observerOptions } = options;
  return useInfiniteScrollQuery<AdminTemplateSummary, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => listMessageTemplates({ status, kind, cursor, limit: pageLimit }),
    limit,
    enabled,
    observerOptions,
    deps: [status, kind, limit],
  });
}

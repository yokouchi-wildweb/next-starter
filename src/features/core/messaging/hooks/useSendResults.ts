"use client";

// src/features/core/messaging/hooks/useSendResults.ts
//
// 送信の結果(公開の部品、D191 D214 (1)): 送った後の画面の材料。届かなかった人は無限スクロール(カーソルのモード)、
// 送信チャンネルごとの数は最後に取ったページの物(どのページにも付いて来る)。送信の詳細の代わりにはしない

import { useState } from "react";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import {
  getAdminSendResults,
  type AdminSendResultFailure,
  type AdminSendResults,
} from "../services/client/sendResultsClient";

const DEFAULT_LIMIT = 50;

export type UseSendResultsOptions = {
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

/** dispatchId = 送った送信(null = まだ無い、取らない) */
export function useSendResults(dispatchId: string | null, options: UseSendResultsOptions = {}) {
  const { limit = DEFAULT_LIMIT, enabled = true, observerOptions } = options;
  const [channels, setChannels] = useState<AdminSendResults["channels"] | null>(null);
  const failed = useInfiniteScrollQuery<AdminSendResultFailure, Record<string, never>>({
    cursorFetcher: async ({ cursor, limit: pageLimit }) => {
      const page = await getAdminSendResults(dispatchId as string, { cursor, limit: pageLimit });
      setChannels(page.channels);
      return page.failed;
    },
    limit,
    enabled: enabled && dispatchId !== null,
    observerOptions,
    deps: [dispatchId, limit],
  });
  return { channels, failed };
}

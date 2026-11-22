"use client";

// src/domains/core/messaging/hooks/useInboxItemDetail.ts
//
// お知らせ 1 件の詳しい表示(SWR、GET /api/me/messaging/inbox/[id])。一覧は要約だけを運ぶので、開いた行の中身(レイアウト・欄の中身・
// 欄の宣言)はここで取る。id が null の間は取らない。取れない間・失敗した時は呼び手が要約(一覧の行)で描ける

import useSWR from "swr";

import { getInboxItem, type InboxItemDetailDto } from "../services/client/inboxClient";
import { inboxItemDetailKey } from "./messagingKeys";

/** SWR のキー(1 件ごと) */

export function useInboxItemDetail(id: string | null) {
  const { data, error, isLoading } = useSWR<InboxItemDetailDto>(id ? inboxItemDetailKey(id) : null, () => getInboxItem(id!), {
    revalidateOnFocus: false,
  });
  return { detail: data ?? null, error, isLoading };
}

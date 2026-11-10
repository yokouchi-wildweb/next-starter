"use client";

// src/features/core/messaging/hooks/useMarkAllInboxRead.ts
//
// 全部を既読にする(今までに公開された行)。成功したら未読の数を再検証する(一覧の印は呼び手が updateItems で変える)

import { useDomainMutation } from "@/lib/crud/hooks";

import { markAllInboxRead } from "../services/client/inboxClient";

import { INBOX_KEY, INBOX_UNREAD_COUNT_KEY } from "./inboxKeys";

export function useMarkAllInboxRead() {
  const mutation = useDomainMutation<void, void>(
    `${INBOX_KEY}/read-all`,
    () => markAllInboxRead(),
    INBOX_UNREAD_COUNT_KEY,
  );
  return { markAllRead: () => mutation.trigger(undefined), isMarking: mutation.isMutating, error: mutation.error };
}

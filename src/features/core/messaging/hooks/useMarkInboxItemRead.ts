"use client";

// src/features/core/messaging/hooks/useMarkInboxItemRead.ts
//
// 1 件を既読にする。成功したら未読の数を再検証する(一覧の印は呼び手が updateItems で変える)

import { useDomainMutation } from "@/lib/crud/hooks";

import { markInboxRead } from "../services/client/inboxClient";

import { INBOX_KEY, INBOX_UNREAD_COUNT_KEY } from "./inboxKeys";

export function useMarkInboxItemRead() {
  const mutation = useDomainMutation<void, string>(
    `${INBOX_KEY}/read`,
    (id) => markInboxRead(id),
    INBOX_UNREAD_COUNT_KEY,
  );
  return { markRead: mutation.trigger, isMarking: mutation.isMutating, error: mutation.error };
}

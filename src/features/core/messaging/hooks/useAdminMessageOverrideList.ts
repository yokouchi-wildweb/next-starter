"use client";

// src/features/core/messaging/hooks/useAdminMessageOverrideList.ts
//
// 管理: 文言を直せる連絡の一覧の流れ(AdminMessageOverrideList はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 一覧(useMessageOverrides、数は小さく固定なので一度に取る)
// - 編集のモーダル(AdminMessageOverrideModal)の開き先: openMessage(鍵)。閉じても鍵は残す(閉じる動きの間、同じ中身を見せる)

import { useCallback, useState } from "react";

import { useMessageOverrides } from "./useMessageOverrides";

export function useAdminMessageOverrideList() {
  const { items, error, isLoading } = useMessageOverrides();
  const [modalOpen, setModalOpen] = useState(false);
  const [messageKey, setMessageKey] = useState<string | null>(null);

  const openMessage = useCallback((key: string) => {
    setMessageKey(key);
    setModalOpen(true);
  }, []);

  return {
    items,
    error,
    isLoading,
    modal: { open: modalOpen, setOpen: setModalOpen, messageKey, openMessage },
  };
}

"use client";

// src/features/core/messaging/hooks/useAdminMessageTemplateList.ts
//
// 管理: テンプレートの一覧の流れ(AdminMessageTemplateList はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 状態で絞る(空 = すべて)+ 無限スクロール(useMessageTemplates、カーソル)
// - 作る・直すモーダル(AdminMessageTemplateModal)の開き先: openNew = 作る、openTemplate(id) = その 1 件を直す。
//   閉じても開き先は残す(閉じる動きの間、同じ中身を見せる)

import { useCallback, useState } from "react";

import { useMessageTemplates } from "./useMessageTemplates";

export type UseAdminMessageTemplateListOptions = {
  observerOptions?: IntersectionObserverInit;
};

export function useAdminMessageTemplateList(options: UseAdminMessageTemplateListOptions = {}) {
  const [status, setStatus] = useState("");
  const query = useMessageTemplates({ status: status || undefined, observerOptions: options.observerOptions });
  const [modalOpen, setModalOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setTemplateId(null);
    setModalOpen(true);
  }, []);
  const openTemplate = useCallback((id: string) => {
    setTemplateId(id);
    setModalOpen(true);
  }, []);

  return {
    status,
    setStatus,
    query,
    modal: {
      open: modalOpen,
      setOpen: setModalOpen,
      /** 直す 1 件(null = 作る) */
      templateId,
      openNew,
      openTemplate,
    },
  };
}

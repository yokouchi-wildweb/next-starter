"use client";

// src/features/core/messaging/hooks/useAdminMessageTemplateList.ts
//
// 管理: テンプレートの一覧の流れ(AdminMessageTemplateList はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 状態で絞る(空 = すべて)+ 無限スクロール(useMessageTemplates、カーソル)
// - 作る・直すモーダル(AdminMessageTemplateModal)の開き先: openNew = 作る、openTemplate(id) = その 1 件を直す。
//   閉じても開き先は残す(閉じる動きの間、同じ中身を見せる)
// - モーダルの操作の後(onChanged): 作った = 先頭から取り直す(並びはサーバーが決める)/ 保存・公開・取り下げ = 返った 1 件で行を置き換える
//   (状態で絞っていて、その状態から外れた行は外す)。無限スクロールの一覧には SWR のキーの再検証が届かないため

import { useCallback, useState } from "react";

import type { AdminTemplateDetail, AdminTemplateSummary } from "../services/client/templateClient";

import type { MessageTemplateAction } from "./useMessageTemplateForm";
import { useMessageTemplates } from "./useMessageTemplates";

/** 1 件の詳しい形から一覧の行の形へ */
function summaryOf(template: AdminTemplateDetail): AdminTemplateSummary {
  const { id, key, name, description, category, categoryLabel, status, currentVersion, createdBy, updatedBy, createdAt, updatedAt } = template;
  return { id, key, name, description, category, categoryLabel, status, currentVersion, createdBy, updatedBy, createdAt, updatedAt };
}

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

  const { revalidate, updateItems, removeItems } = query;
  const onChanged = useCallback(
    (template: AdminTemplateDetail, action: MessageTemplateAction) => {
      if (action === "create") return revalidate();
      if (status && template.status !== status) return removeItems((item) => item.id === template.id);
      updateItems(
        (item) => item.id === template.id,
        () => summaryOf(template),
      );
    },
    [status, revalidate, updateItems, removeItems],
  );

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
      /** モーダルの操作の後(AdminMessageTemplateModal の onChanged に渡す) */
      onChanged,
    },
  };
}

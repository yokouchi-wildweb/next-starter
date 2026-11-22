"use client";

// src/domains/core/messaging/hooks/useAdminMessageTemplateList.ts
//
// 管理: テンプレートの一覧の流れ(AdminMessageTemplateList はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 種別で絞る(空 = すべて。種別 = その種別のカテゴリーのテンプレート、D135)+ 文字の検索(名前か文面。入力 search と確定 q を分け、
//   「検索」か Enter で確定、前後の空白を落として空なら探さない、100 字で切る)+ 無限スクロール(useMessageTemplates、カーソル)
// - 作る・直すモーダル(AdminMessageTemplateModal)の開き先: openNew = 作る、openTemplate(id) = その 1 件を直す。
//   閉じても開き先は残す(閉じる動きの間、同じ中身を見せる)
// - モーダルの操作の後(onChanged): 作った = 先頭から取り直す(並びはサーバーが決める)/ 保存(= 公開、D134)= 返った 1 件で行を置き換える / 削除(D137)= 行を外す。
//   種別で絞っている間・文字で探している間の保存は取り直す(絞りから外れたかは一覧で分からない: 種別はカテゴリーから決まり、文字の当たりはサーバーが決める)。
//   無限スクロールの一覧には SWR のキーの再検証が届かないため

import { useCallback, useState } from "react";

import type { AdminTemplateDetail, AdminTemplateSummary } from "../services/client/templateClient";

import type { MessageTemplateAction } from "./useMessageTemplateForm";
import { useMessageTemplates } from "./useMessageTemplates";

/** テンプレートの文字の検索の上限(サーバーの q と同じ) */
export const TEMPLATE_QUERY_MAX = 100;

/** 検索の入力 → q(前後の空白を落とす。空は ""、長すぎる分は切る) */
export function templateQueryOf(text: string): string {
  return text.trim().slice(0, TEMPLATE_QUERY_MAX);
}

/** 1 件の詳しい形から一覧の行の形へ */
function summaryOf(template: AdminTemplateDetail): AdminTemplateSummary {
  const { id, key, name, description, category, categoryLabel, currentVersion, createdBy, updatedBy, createdAt, updatedAt } = template;
  const { layout, values, usable } = template;
  return {
    id,
    key,
    name,
    description,
    category,
    categoryLabel,
    currentVersion,
    createdBy,
    updatedBy,
    createdAt,
    updatedAt,
    layout,
    values,
    usable,
  };
}

export type UseAdminMessageTemplateListOptions = {
  observerOptions?: IntersectionObserverInit;
};

export function useAdminMessageTemplateList(options: UseAdminMessageTemplateListOptions = {}) {
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const query = useMessageTemplates({ kind: kind || undefined, q: q || undefined, observerOptions: options.observerOptions });
  const applySearch = useCallback(() => setQ(templateQueryOf(search)), [search]);
  const clearSearch = useCallback(() => {
    setSearch("");
    setQ("");
  }, []);
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
      if (action === "delete") return removeItems((item) => item.id === template.id);
      if (kind || q) return revalidate();
      updateItems(
        (item) => item.id === template.id,
        () => summaryOf(template),
      );
    },
    [kind, q, revalidate, updateItems, removeItems],
  );

  return {
    /** 種別の絞り(空 = すべて、D135) */
    kind,
    setKind,
    /** 文字の検索: search = 入力中、q = 確定した文字(空 = 探さない)。applySearch = 確定、clearSearch = 両方を空に */
    search: { text: search, setText: setSearch, q, apply: applySearch, clear: clearSearch },
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

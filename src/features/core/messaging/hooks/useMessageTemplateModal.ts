"use client";

// src/features/core/messaging/hooks/useMessageTemplateModal.ts
//
// 管理: テンプレートを作る・直すモーダルの流れ(AdminMessageTemplateModal はこれと useMessageTemplateForm を呼んで部品を並べるだけ)。
// - 開いている間だけ選択肢・1 件・版の一覧を取る(閉じている一覧の画面では取らない)
// - 作る → 保存で下書きができたら、同じモーダルのままその 1 件を直す形に変わる(onCreated。ページは移らない)
// - 開き直すたびに作った id とタブを戻す(session。書く欄は formKey で key して作り直す)
// - formKey = 開いた回 + 1 件の版と更新(保存・公開・取り下げの後は書く欄をサーバーの値で作り直す)

import { useCallback, useState } from "react";

import { useMessageTemplate, useMessageTemplateOptions } from "./useMessageTemplate";
import { useMessageTemplateVersions } from "./useMessageTemplateVersions";
import { useModalSession } from "./useModalSession";

/** モーダルのタブ */
export type MessageTemplateModalTab = "text" | "variables" | "versions";

export type UseMessageTemplateModalOptions = {
  open: boolean;
  /** 直す 1 件(null・省略 = 作る) */
  templateId?: string | null;
};

export function useMessageTemplateModal({ open, templateId = null }: UseMessageTemplateModalOptions) {
  const session = useModalSession(open);
  const [created, setCreated] = useState<{ session: number; id: string } | null>(null);
  const [tabState, setTabState] = useState<{ session: number; tab: MessageTemplateModalTab } | null>(null);
  // 前に開いた回の物は使わない(開き直しで戻す。effect で消さない)
  const createdId = created && created.session === session ? created.id : null;
  const tab: MessageTemplateModalTab = tabState && tabState.session === session ? tabState.tab : "text";
  const currentId = createdId ?? templateId;

  const { options, error: optionsError } = useMessageTemplateOptions(open);
  const { template, error: templateError, isLoading: templateLoading } = useMessageTemplate(open ? currentId : null);
  const { versions } = useMessageTemplateVersions(open ? currentId : null);

  const setTab = useCallback((next: string) => setTabState({ session, tab: next as MessageTemplateModalTab }), [session]);
  const onCreated = useCallback((id: string) => setCreated({ session, id }), [session]);

  const state: "loading" | "error" | "missing" | "ready" = optionsError
    ? "error"
    : !options || (currentId && templateLoading && !template)
      ? "loading"
      : currentId && !template
        ? templateError
          ? "error"
          : "missing"
        : "ready";

  return {
    state,
    /** 取れなかった理由(state error の時) */
    error: optionsError ?? templateError ?? null,
    mode: currentId ? ("edit" as const) : ("create" as const),
    options,
    template: currentId ? template : null,
    versions,
    tab,
    setTab,
    onCreated,
    formKey: template && currentId
      ? `${session}:${template.id}:${template.updatedAt ?? ""}:${template.currentVersion ?? ""}:${template.status}`
      : `${session}:new`,
  };
}

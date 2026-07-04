// src/features/core/interactionTracking/components/common/InteractionAudienceModal/index.tsx

"use client";

import { useMemo, type ReactNode } from "react";

import TabbedModal, { type TabbedModalTab } from "@/components/Overlays/TabbedModal";
import { useInteractionAudienceSummary } from "@/features/core/interactionTracking/hooks/useInteractionAudienceSummary";

import { AudienceTabContent } from "./AudienceTabContent";

export type InteractionAudienceTabDef = {
  /** 表示する action（例: "click"） */
  action: string;
  /** タブの表示ラベル（i18n は消費側の責務） */
  label: ReactNode;
};

export type InteractionAudienceModalProps = {
  targetType: string;
  targetId: string;
  /** action ごとに 1 タブ。例: [{ action: "click", label: "バナークリック" }] */
  tabs: InteractionAudienceTabDef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** モーダルタイトル。省略時 "クリックしたユーザー" */
  title?: ReactNode;
  maxWidth?: number | string;
};

/**
 * 「target X を誰がクリックしたか」の汎用オーディエンスビューア（admin 画面用）。
 *
 * action ごとのタブで、上部にサマリー（累計 / ログイン済み / 匿名）、
 * 下部にクリックしたユーザーの一覧（無限スクロール・並び替え付き）を表示する。
 *
 * 使用例（管理一覧の行クリックから）:
 * ```tsx
 * <InteractionAudienceModal
 *   targetType="bulletin"
 *   targetId={selected.id}
 *   tabs={[
 *     { action: "click", label: "バナークリック" },
 *     { action: "link_click", label: "リンククリック" },
 *   ]}
 *   open={Boolean(selected)}
 *   onOpenChange={(open) => { if (!open) setSelected(null); }}
 * />
 * ```
 *
 * 認可は admin 限定 API（/api/admin/interactions/**）側で強制される。
 * 本コンポーネントは admin 画面以外に置かないこと（一般ユーザーには 403 になる）。
 */
export function InteractionAudienceModal({
  targetType,
  targetId,
  tabs,
  open,
  onOpenChange,
  title = "クリックしたユーザー",
  maxWidth = 720,
}: InteractionAudienceModalProps) {
  const { data: summaryMap, isLoading: isSummaryLoading } = useInteractionAudienceSummary(
    targetType,
    targetId,
    { enabled: open },
  );

  const modalTabs = useMemo<TabbedModalTab[]>(
    () =>
      tabs.map((tab) => ({
        value: tab.action,
        label: tab.label,
        content: (
          <AudienceTabContent
            targetType={targetType}
            targetId={targetId}
            action={tab.action}
            summary={summaryMap?.[tab.action]}
            isSummaryLoading={isSummaryLoading}
          />
        ),
      })),
    [tabs, targetType, targetId, summaryMap, isSummaryLoading],
  );

  return (
    <TabbedModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      tabs={modalTabs}
      maxWidth={maxWidth}
    />
  );
}

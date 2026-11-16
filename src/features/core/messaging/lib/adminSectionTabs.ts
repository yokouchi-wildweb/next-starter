// src/features/core/messaging/lib/adminSectionTabs.ts
//
// 通知の管理画面(送信一覧・テンプレート・文言の編集)のセクションタブを組み立てる。
// メニューの項目は「送信一覧」1 つだけで、3 画面はこのタブで行き来する。
// 門が閉の画面(messagingTemplates / messagingOverrides)のタブは外す。門の読み方は呼び手が渡す(client は useGate)。
// 通知の管理画面(上流・下流とも)はタブの配列を自分で組まず、必ずこの関数を使う。

import type { PageTabItem } from "@/components/Navigation";
import type { FeatureName } from "@/featureGate";

/** 通知の管理画面のベース URL */
export const MESSAGING_ADMIN_BASE_PATH = "/admin/messaging";

type MessagingSectionTabDefinition = PageTabItem & {
  /** このタブの画面を開く門(無ければいつも出す) */
  gate?: FeatureName;
};

const MESSAGING_ADMIN_SECTION_TABS: readonly MessagingSectionTabDefinition[] = [
  { value: "dispatches", label: "送信一覧", href: MESSAGING_ADMIN_BASE_PATH },
  { value: "templates", label: "テンプレート", href: `${MESSAGING_ADMIN_BASE_PATH}/templates`, gate: "messagingTemplates" },
  { value: "overrides", label: "文言の編集", href: `${MESSAGING_ADMIN_BASE_PATH}/overrides`, gate: "messagingOverrides" },
];

/**
 * 通知の管理画面のセクションタブ(門が閉の画面のタブは外す)。
 * 今の画面のタブは href の完全一致で決まる(送信の詳細 /admin/messaging/[id] はどのタブにも当たらない)。
 */
export function buildMessagingAdminSectionTabs(enabled: (gate: FeatureName) => boolean): PageTabItem[] {
  return MESSAGING_ADMIN_SECTION_TABS.filter((tab) => !tab.gate || enabled(tab.gate)).map(({ gate: _gate, ...tab }) => tab);
}

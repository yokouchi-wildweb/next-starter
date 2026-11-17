// src/features/core/messaging/services/server/admin/layoutChannelView.ts
//
// 管理画面のプレビューの経路 1 つの「ひな形の描き方で描く材料」: その経路が使う欄の中身と要約(lib buildChannelContent と同じ絞り)。
// お知らせ(inApp)は client のひな形の描き方(layoutInApps)がこの values と summary で描く。メールの HTML は呼び手が経路の preview で描く。
// 呼び手: 文言の編集のプレビュー(overrides)・送った回のプレビュー(dispatchPreview)

import { fieldsForChannel, type MessageLayout, type MessageLayoutSummary } from "@/lib/messaging";

export type LayoutChannelView = {
  /** ひな形の鍵 */
  layout: string;
  /** その経路が使う欄だけの中身 */
  values: Record<string, unknown>;
  /** 要約(作れなければ null) */
  summary: MessageLayoutSummary | null;
  /** 要約を作れない理由(作れれば null) */
  cannotRender: string | null;
};

export function layoutChannelView(layout: MessageLayout, values: Readonly<Record<string, unknown>>, channel: string): LayoutChannelView {
  const keys = Object.keys(fieldsForChannel(layout, channel));
  const own = Object.fromEntries(keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]));
  try {
    return { layout: layout.key, values: own, summary: layout.summary(own as never), cannotRender: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { layout: layout.key, values: own, summary: null, cannotRender: `ひな形「${layout.label}」の要約を作れません(${reason})` };
  }
}

// src/features/core/messaging/services/server/admin/sourceLabels.ts
//
// 送り元(message_dispatches.source)の表示名(回の詳細の「送り元」。運営する人に鍵を見せない、D46)。引く順:
// 1. 受け口 sources の項目の label(上流は messaging の管理の送り元、fork は自分の送り元を足す)
// 2. 同じ鍵の連絡の定義の label(cron・業務の送信の送り元の既定 = 定義の鍵)
// 3. 一括送信の対象: `<対象の鍵>.bulk` = 「<対象の label>の一括送信」、`.bulk.test` = 「…の一括送信のテスト」
// どれにも当たらなければ null(画面は送り元の行を出さない)

import type { MessageSource } from "@/lib/messaging";

export type SourceLabelDeps = {
  sources: Readonly<Record<string, MessageSource>>;
  /** 連絡の鍵 → 定義の label(上書きの後)。無い鍵は null */
  messageLabel: (messageKey: string) => Promise<string | null>;
  /** 一括送信の対象(鍵 → 表示名) */
  bulkTargets: Readonly<Record<string, { label: string }>>;
};

export async function sourceLabelOf(deps: SourceLabelDeps, source: string): Promise<string | null> {
  const own = deps.sources[source]?.label;
  if (own) return own;
  const message = await deps.messageLabel(source);
  if (message) return message;
  const bulk = /^(.+)\.bulk(\.test)?$/.exec(source);
  const target = bulk ? deps.bulkTargets[bulk[1]!] : undefined;
  if (target) return bulk![2] ? `${target.label}の一括送信のテスト` : `${target.label}の一括送信`;
  return null;
}

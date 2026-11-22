// src/domains/core/messaging/services/server/admin/sourceLabels.ts
//
// 送り元(message_dispatches.source)の表示名(送信の詳細の「送り元」。運営する人に鍵を見せない、D46)。引く順:
// 1. 点 messagingSources の項目の label(上流は messaging の管理の送り元、fork は自分の送り元を足す)
// 2. 同じ鍵の連絡定義の label(cron・業務の送信の送り元の既定 = 定義の鍵)
// 3. 記録の宛先(recordTargets)の一括送信: `<記録の宛先の鍵>.bulk` = 「<label>の一括送信」、`.bulk.test` = 「…の一括送信のテスト」(閉じたドメインの物は引かない)
// どれにも当たらなければ null(画面は送り元の行を出さない)

import type { MessageSource } from "@/lib/messaging";

export type SourceLabelDeps = {
  sources: Readonly<Record<string, MessageSource>>;
  /** 連絡の鍵 → 定義の label(上書きの後)。無い鍵は null */
  messageLabel: (messageKey: string) => Promise<string | null>;
  /** 記録の宛先の鍵 → 表示名(門番を通す。無い・閉じたドメインは null) */
  recordTargetLabel: (key: string) => Promise<string | null>;
};

export async function sourceLabelOf(deps: SourceLabelDeps, source: string): Promise<string | null> {
  const own = deps.sources[source]?.label;
  if (own) return own;
  const message = await deps.messageLabel(source);
  if (message) return message;
  const bulk = /^(.+)\.bulk(\.test)?$/.exec(source);
  const label = bulk ? await deps.recordTargetLabel(bulk[1]!) : null;
  if (label) return bulk![2] ? `${label}の一括送信のテスト` : `${label}の一括送信`;
  return null;
}

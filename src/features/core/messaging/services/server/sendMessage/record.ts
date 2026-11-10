// src/features/core/messaging/services/server/sendMessage/record.ts
//
// 本文の残し方(record: meta / vars / full)と、required・秘密を差し込む連絡の守り(D33・D34)。
// - required か秘密の印の鍵を持つ連絡(noBody): 描いた本文をどこにも残さない(回・配達・metadata・誤りの文)。
//   キューにも置けないので、要求の中で送り切る(一時の失敗は短く再送して尽きたら failed)
// - required: vars の写しも残さない。秘密の印の鍵は record に依らず写しから落とす
// - 件名・題(headings)は常に残す(秘密の鍵は差し込まない)

import type { MessageRecord } from "@/lib/messaging";

import { secretKeysOf } from "./context";
import type { AnyResolvedMessageDefinition } from "./definition";

export type RecordPolicy = {
  record: MessageRecord;
  /** 秘密の印の鍵 */
  secretKeys: string[];
  /** 描いた本文を残さない(required か秘密の鍵あり)。キューにも置かない */
  noBody: boolean;
  /** 回の vars と配達の受信者ごとの値の写しを残す(秘密の鍵は落とす) */
  keepVars: boolean;
  /** 全員同文の描画結果を回に残す */
  keepRendered: boolean;
  /** 受信者ごとの描いた本文を配達の行に残す */
  keepRecipientBody: boolean;
};

export function recordPolicyOf(resolved: AnyResolvedMessageDefinition): RecordPolicy {
  const record = resolved.record ?? "vars";
  const secretKeys = secretKeysOf(resolved);
  const noBody = Boolean(resolved.required) || secretKeys.length > 0;
  return {
    record,
    secretKeys,
    noBody,
    keepVars: !resolved.required && record !== "meta",
    keepRendered: !noBody && record !== "meta",
    keepRecipientBody: !noBody && record === "full",
  };
}

/** 鍵を落とした写し */
export function omitKeys(
  values: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !keys.includes(key)));
}

const ERROR_TEXT_MAX = 500;

/** 配達の行の誤りの文。noBody の連絡は理由の符号だけ(経路の文言に本文が混ざりうる) */
export function errorText(policy: RecordPolicy, reason: string, message: string | undefined): string {
  if (policy.noBody || !message) return reason;
  return `${reason}: ${message}`.slice(0, ERROR_TEXT_MAX);
}

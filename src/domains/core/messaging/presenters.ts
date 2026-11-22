// src/domains/core/messaging/presenters.ts
//
// messaging の表示の整え(上流の画面と fork の画面が読む。client からも読める: config の値だけを読む)。
// - 種別(kind)の表示名(D186・D187・D189): 値は config の kindLabels(fork は src/config/domains/messaging.config.ts で変える)。
//   利用者の画面 = label、管理画面 = adminLabel(無ければ label)。知らない種別は鍵のまま

import type { MessageKind } from "@/lib/messaging";

import { messagingConfig } from "./config";

function kindEntry(kind: string): { label: string; adminLabel?: string } | undefined {
  return Object.hasOwn(messagingConfig.kindLabels, kind) ? messagingConfig.kindLabels[kind as MessageKind] : undefined;
}

/** 利用者の画面の種別の表示名(通知設定の種別の枠の見出しなど) */
export function messageKindLabel(kind: string): string {
  return kindEntry(kind)?.label ?? kind;
}

/** 管理画面の種別の表示名(adminLabel、無ければ label) */
export function messageKindAdminLabel(kind: string): string {
  const entry = kindEntry(kind);
  return entry ? (entry.adminLabel ?? entry.label) : kind;
}

/** 管理画面の種別の選択肢(config の並び = lib の MESSAGE_KINDS の順) */
export function messageKindAdminOptions(): { value: MessageKind; label: string }[] {
  return (Object.keys(messagingConfig.kindLabels) as MessageKind[]).map((kind) => ({ value: kind, label: messageKindAdminLabel(kind) }));
}

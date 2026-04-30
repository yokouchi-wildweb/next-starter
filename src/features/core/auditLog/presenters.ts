// src/features/core/auditLog/presenters.ts
//
// action 名 → 表示ラベル変換と、ログ表示時のフォーマッタ群。
// ドメイン側で追加 action を表示したい場合は registerActionLabels() で登録する。

import type { AuditActorType } from "@/features/core/auditLog/constants";
import { ACTOR_TYPE_LABELS } from "@/features/core/auditLog/constants";

/**
 * 既定の action 名 → 日本語ラベル辞書。
 * テンプレートで提供している user 系 action のみ含む。
 * 他ドメインの action ラベルは registerActionLabels() で追加登録する。
 */
const DEFAULT_ACTION_LABELS: Record<string, string> = {
  // user lifecycle
  "user.preregistered": "仮登録",
  "user.registered": "本登録",
  "user.rejoined": "再入会",
  "user.paused": "休会",
  "user.reactivated": "復帰",
  "user.withdrew": "退会",

  // admin actions on user
  "user.status.changed": "ステータス変更",
  "user.role.changed": "ロール変更",
  "user.email.changed": "メールアドレス変更",
  "user.name.changed": "ユーザー名変更",
  "user.created_by_admin": "管理者によるユーザー作成",
  "user.reregistered_by_admin": "管理者による再登録",
  "user.soft_deleted": "論理削除",
  "user.hard_deleted": "物理削除",
  "user.restored": "復元",

  // generic CRUD action labels (createCrudService 自動記録分)
  "user.created": "ユーザー作成",
  "user.updated": "ユーザー情報更新",
  "user.deleted": "ユーザー削除",
  "user.upserted": "ユーザー upsert",
  "user.bulk_deleted": "ユーザー一括削除",
  "user.bulk_hard_deleted": "ユーザー一括物理削除",
  "user.bulk_updated": "ユーザー一括更新",
  "user.bulk_upserted": "ユーザー一括 upsert",
};

const customActionLabels: Record<string, string> = {};

/**
 * フォーク先のドメインで追加 action を登録する。
 * 例: registerActionLabels({ "post.published": "公開" })
 *
 * 登録した action は AuditTimeline / 管理画面で日本語表示される。
 */
export function registerActionLabels(labels: Record<string, string>): void {
  Object.assign(customActionLabels, labels);
}

/**
 * action 名 → 表示ラベル。未登録の action はそのまま返す。
 */
export function formatActionLabel(action: string): string {
  return customActionLabels[action] ?? DEFAULT_ACTION_LABELS[action] ?? action;
}

/**
 * actorType → 日本語ラベル。
 */
export function formatActorTypeLabel(actorType: string): string {
  return ACTOR_TYPE_LABELS[actorType as AuditActorType] ?? actorType;
}

/**
 * created_at の表示フォーマッタ。
 */
export function formatAuditDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

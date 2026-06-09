// src/features/core/notification/services/server/notification/viewer.ts
// 通知の可視性を判定するための「閲覧者コンテキスト」。
//
// ユーザー向け通知クエリ (getMyNotifications / Page / Count / markAllAsRead) は
// すべてこの NotificationViewer を受け取り、buildVisibilityWhere() で可視性を判定する。
// 可視性ルールにユーザー属性を増やしたいときは、ここに項目を足す → buildVisibilityWhere に
// ルールを足す、の2箇所だけで全消費者へ波及する（呼び出しシグネチャは変えない）。

import type { SessionUser } from "@/features/core/auth/entities/session";

/**
 * 通知の可視性判定に必要な閲覧者の情報。
 * 現状は userId / role のみ。将来ルールが増えたら属性を追加する拡張点。
 */
export type NotificationViewer = {
  userId: string;
  role: string;
};

/**
 * セッションから NotificationViewer を生成する。
 * userId / role は JWT セッション由来（現挙動を維持）。
 * DB から eager に取得したい属性が必要になった場合は、ここを非同期 resolver 化する。
 */
export function notificationViewerFromSession(session: SessionUser): NotificationViewer {
  return { userId: session.userId, role: session.role };
}

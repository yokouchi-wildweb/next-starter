// src/features/core/notification/config.ts
// お知らせ(通知)の設定(既定 + 上書き)。上書きは src/config/features/notification.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。
// 管理者の全体配信の入切(enableAdminBroadcast)は機能のスイッチなので、門番の議会が移すまで src/config/app/app-features.config.ts に残る

import override from "@/config/features/notification.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type NotificationConfig = {
  /** ユーザー側に未読通知モーダルを表示する */
  showUnreadModal: boolean;
  /** 未読通知モーダルを表示するパス一覧(完全一致。末尾 * で前方一致) */
  unreadModalPaths: readonly string[];
};

const defaults: NotificationConfig = {
  showUnreadModal: false,
  unreadModalPaths: ["/"],
};

export const notificationConfigDef = defineConfig(defaults, { label: "notification" });

/** 上書きのファイルの型(`export default { ... } satisfies NotificationOverride`) */
export type NotificationOverride<E extends object = Record<never, never>> = OverrideOf<typeof notificationConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const notificationConfig: NotificationConfig = notificationConfigDef.compose(override);

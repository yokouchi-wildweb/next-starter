// src/features/core/messaging/constants/preferences.ts
//
// 好み(種類 × 経路の配信停止)の利用者のページと API の住所。
// 門 messagingPreferences の pathPatterns(src/featureGate/rules/messagingPreferences.ts)と同じ値を持つ(API はテストで照合。ページの住所はページと一緒に規則へ足す)。

/** 好みのページ(マイページのアカウントの設定の並び) */
export const MESSAGE_PREFERENCES_PAGE_PATH = "/mypage/account/notifications";

/** 好みの読み書きの API(本人の行だけ) */
export const MESSAGE_PREFERENCES_API_PATH = "/api/me/messaging/preferences";

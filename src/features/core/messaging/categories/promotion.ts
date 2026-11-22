// src/features/core/messaging/categories/promotion.ts
// 上流のカテゴリー: 管理画面「一般的なプロモーション」/ 利用者「キャンペーン情報」(種別 promotion、D124)。自由連絡の宣伝(白紙のシステムテンプレート templates/promotion.ts)の既定のカテゴリー

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "promotion",
  label: "キャンペーン情報",
  adminLabel: "一般的なプロモーション",
  description: "新しい機能やキャンペーンなどのお知らせ",
  kind: "promotion",
  channels: ["email", "inApp"],
  // 送る画面の送信方法は最初お知らせだけ(メールは送る時に入れる、D119)
  defaultChannels: ["inApp"],
};

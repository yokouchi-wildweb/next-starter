// src/app/api/cron/wallet-expiration-notice/route.ts
// ウォレット失効通知（失効予告 + 失効時の本通知）を送る cron タスク
//
// wallet-expiration.config.ts の notice を設定した通貨のみ対象。
// 設定が無ければクエリを発行せず即終了（no-op）するため、未オプトインのプロジェクトでも登録して害はない。
//
// - 失効スイープ（wallet-expire-lots）とは別に動く（送信の遅さを没収処理に影響させない）
// - 冪等: 同じ対象には1回しか届かない。実行が重なっても二重送信にならない
// - 時間予算内で送りきれなかった分は次回実行が続きから処理する
//
// 推奨スケジュール: 毎時
//   10 * * * *
//   送信量が多いプロジェクトは頻度を上げる。メールを送る時間帯を絞りたい場合は
//   スケジュール側で制限する（例: 0 0-12 * * * = JST 9〜21時）
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { sendWalletExpirationNotices } from "@/features/core/wallet/services/server/notification/sendWalletExpirationNotices";

// 時間予算（既定 240 秒）より長く取る
export const maxDuration = 300;

export const GET = createCronRoute({
  name: "wallet-expiration-notice",
  handler: async () => {
    const result = await sendWalletExpirationNotices();
    return result;
  },
});

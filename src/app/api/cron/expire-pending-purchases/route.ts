// src/app/api/cron/expire-pending-purchases/route.ts
// 期限切れ pending 購入リクエストを expired に遷移する定期タスク
//
// スケジューラからの呼び出し想定（Vercel Cron / Upstash / 外部 cron）。
// 本タスクは onExpire フックを持つ purchase_type の副次テーブル掃除も行う。
//
// 推奨スケジュール: 15分間隔（expires_at = 作成から30分後）
//   */15 * * * *
//
// 認証: Authorization: Bearer ${CRON_SECRET}
//   development では認証バイパス（src/lib/cron/auth.ts 参照）

import { createCronRoute } from "@/lib/cron";
import { expirePendingRequests } from "@/features/core/purchaseRequest/services/server/wrappers/purchaseService";

export const GET = createCronRoute({
  name: "expire-pending-purchases",
  handler: async () => {
    const expired = await expirePendingRequests();
    return { expired };
  },
});

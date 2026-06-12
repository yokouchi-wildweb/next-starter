// src/app/api/me/wallet/route.ts
//
// 認証済みユーザー本人のウォレット残高を返す。
// オーナーシップはサーバー側で user.userId に固定して強制する
// （クライアント指定の user_id は受け取らない）。

import { createMeRoute, ownerWhere } from "@/lib/routeFactory";
import { walletService } from "@/features/core/wallet/services/server/walletService";

// GET /api/me/wallet : 本人の全ウォレット（通貨種別ごと）を取得
export const GET = createMeRoute(
  {
    operation: "GET /api/me/wallet",
    operationType: "read",
  },
  async (_req, { user }) => {
    const result = await walletService.search({ where: ownerWhere(user) });
    return { wallets: result.results ?? [] };
  },
);

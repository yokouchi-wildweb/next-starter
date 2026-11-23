// src/app/api/me/wallet/route.ts
//
// 認証済みユーザー本人のウォレット残高を返す。
// オーナーシップはサーバー側で user.userId に固定して強制する
// （クライアント指定の user_id は受け取らない）。

import { createMeRoute, ownerWhere } from "@/wiring/apiRoute";
import { walletService } from "@/domains/core/wallet/services/server/walletService";
import { VALID_WALLET_TYPES } from "@/domains/core/wallet/utils/currency";

// GET /api/me/wallet : 本人の全ウォレット（通貨種別ごと）を取得
export const GET = createMeRoute(
  {
    operation: "GET /api/me/wallet",
    operationType: "read",
  },
  async (_req, { user }) => {
    // 1 人 1 通貨 1 行(wallets_user_type_idx、type の enum は設定の通貨)なので、行は通貨の数まで
    const result = await walletService.search({ where: ownerWhere(user), limit: VALID_WALLET_TYPES.length });
    return { wallets: result.results ?? [] };
  },
);

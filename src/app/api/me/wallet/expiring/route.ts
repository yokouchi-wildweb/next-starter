// src/app/api/me/wallet/expiring/route.ts
//
// 認証済みユーザー本人の失効間近残高（ロット）を返す。
// オーナーシップはサーバー側で user.userId に固定して強制する。
// 有効期限が無効な walletType では常に空（エラーにはしない。UI 側の分岐を単純にするため）。
//
// クエリ:
// - walletType: 必須（currency.config.ts のキー）
// - withinDays: 任意（デフォルト 30、1〜365 にクランプ）

import { createMeRoute } from "@/lib/routeFactory";
import { getExpiringLots } from "@/features/core/wallet/services/server/lots";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { DomainError } from "@/lib/errors/domainError";

const DEFAULT_WITHIN_DAYS = 30;
const MAX_WITHIN_DAYS = 365;

// GET /api/me/wallet/expiring?walletType=regular_coin&withinDays=30
export const GET = createMeRoute(
  {
    operation: "GET /api/me/wallet/expiring",
    operationType: "read",
  },
  async (req, { user }) => {
    const searchParams = new URL(req.url).searchParams;

    const walletType = searchParams.get("walletType");
    if (!walletType || !(walletType in CURRENCY_CONFIG)) {
      throw new DomainError("walletType が不正です。", { status: 400 });
    }

    const withinDaysRaw = Number(searchParams.get("withinDays") ?? DEFAULT_WITHIN_DAYS);
    const withinDays = Number.isFinite(withinDaysRaw)
      ? Math.min(Math.max(Math.trunc(withinDaysRaw), 1), MAX_WITHIN_DAYS)
      : DEFAULT_WITHIN_DAYS;

    const summary = await getExpiringLots(user.userId, walletType as WalletType, withinDays);
    return { ...summary, withinDays };
  },
);

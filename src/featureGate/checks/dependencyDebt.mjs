// src/featureGate/checks/dependencyDebt.mjs
// 依存の検査の上流の縮む表(L1.20、総司令 m7: 置き場の木 D43 の一時許可と同じ扱い)。門番の中の検査と node の道具(features:list)だけが読む。
// - 新しい違反は表に足せない(足すのは上流の今の違反を写したときだけ。新しい違反は requires・gate・required/・例外で通す)
// - 直った行は同じ commit で表から消す(test:feature-gate が「直った行が残っている」で落とす)
// - 0 行になった出荷で、この表と読み取りのコード(dependencies.test.mjs・node/describe.ts の debt の扱い)も消す
// 行の中身(直し方)は持ち主の legate の持ち分。ここでは変えない

/** 消す依頼がまだ無い行の order */
export const NOT_FILED = "未起票";

/** 上流の例外(縮む表。当たらなくなった行は失敗) */
export const UPSTREAM_DEPENDENCY_EXCEPTIONS = {
  "src/wiring/apiRoute.ts": "常に読まれる API の結線。端末の束(pairedDevice)を Factory に結ぶだけで、端末の判定は pairedDevice の側が gate.enabled(\"pairedDevice\") で自分を閉じる(deviceToken.ts)",
};

export const OWNER = "設定の議会の legate(legate-20261023-175358-config-redesign.1)";

/**
 * 今の上流の違反(縮む表、L1.12・L1.20)。キー = "<ファイル> → <閉じられるフォルダ>"。
 * order = 消す依頼(持ち主の legate の指令 id。まだ無ければ "未起票")。
 * how の先頭 requires: = 持ち主が domainEntry.ts に requires を書けば消える行 / gate: = gate.enabled などで確かめれば消える行
 */
export const UPSTREAM_DEPENDENCY_DEBT = {
  "src/features/core/couponAttributionReward/entities/drizzle.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: couponAttributionReward の domainEntry に wallet' },
  "src/features/core/couponAttributionReward/services/server/grant.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: couponAttributionReward の domainEntry に wallet' },
  "src/features/core/purchaseRequest/components/PurchaseAwaitingReview/index.tsx → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/components/PurchaseFailed/index.tsx → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/constants/field.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/entities/drizzle.ts → core/walletHistory": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/completion/strategies/walletTopup.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/payment/inhouse/inhouseProvider.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/wrappers/initiatePurchase.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/wrappers/purchaseHelpers.ts → core/wallet": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/referral/components/InviteCode/index.tsx → core/coupon": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/referral/services/server/coupon/referralHandler.ts → core/coupon": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/referral/services/server/wrappers/getInviteCodeListWithCounts.ts → core/coupon": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/referral/services/server/wrappers/validateInviteCode.ts → core/coupon": { owner: OWNER, order: "legate-20261023-175358-config-redesign.1 sheet:02", how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
};

/** 縮む表のキー(違反・依存の 1 件から) */
export const debtKeyOf = (v) => `${v.file} → ${v.folder}`;

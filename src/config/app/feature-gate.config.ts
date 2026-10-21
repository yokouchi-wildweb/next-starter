// src/config/app/feature-gate.config.ts

// 機能ゲート（Feature Gate）の定義。
// enabled が false のルールは次の 2 か所で効く:
// - ルートゲート（src/proxies/featureGate.ts）: pathPatterns に一致するページ / API を 404 にする
// - スキーマゲート（pnpm db:push / db:push:check）: tables を push 対象から外す
//   作る方向にしか働かない。false の間は作らず、既にあるテーブルも消さない（true にした次の push で作られる）
// 詳細: src/proxies/README.md

import { APP_FEATURES } from "./app-features.config";
import { CURRENCY_CONFIG } from "./currency.config";
import { PAIRED_DEVICE_CONFIG } from "./paired-device.config";
import { isPaymentMethodSelectable } from "./payment.config";

export type FeatureGateRule = {
  /** ブロック対象のパス（セグメント境界の前方一致。"/demo" は "/demo-login" を含まない） */
  pathPatterns: string[];
  /** false の間 push 対象から外すテーブル名（pgTable の第 1 引数）。enum は外さない */
  tables?: string[];
  /** この機能が有効か */
  enabled: boolean;
  /** ブロック時の rewrite 先（省略時: API は 404、ページは /404） */
  redirectTo?: string;
};

const walletSlugs = Object.values(CURRENCY_CONFIG).map((currency) => currency.slug);

export const featureGateRules: FeatureGateRule[] = [
  // サインアップ
  {
    pathPatterns: [
      "/signup",
      "/api/auth/register",
      "/api/auth/pre-register",
      "/api/auth/send-email-link",
      "/api/auth/send-early-registration-link",
    ],
    enabled: APP_FEATURES.auth.signup.enabled,
    redirectTo: "/signup-closed",
  },
  // ウォレット（残高・履歴・ロット。決済は下の payment）
  {
    pathPatterns: [
      "/wallet",
      "/api/wallet",
      "/api/walletHistory",
      "/api/me/wallet",
      "/api/admin/wallet",
      "/api/admin/analytics/wallet",
      "/api/admin/analytics/wallet-history",
      "/api/admin/analytics/coin-issuance",
      "/api/cron/wallet-expiration-notice",
      "/api/cron/wallet-expire-lots",
      "/api/cron/wallet-lots-prune",
    ],
    tables: ["wallets", "wallet_lots", "wallet_histories"],
    enabled: APP_FEATURES.wallet.enabled,
  },
  // 決済（購入・決済プロバイダ webhook・銀行振込・購入上限）
  {
    pathPatterns: [
      ...walletSlugs.map((slug) => `/wallet/${slug}/purchase`),
      "/api/wallet/purchase",
      "/api/purchaseRequest",
      "/api/webhook/payment",
      "/api/admin/analytics/purchase",
      "/api/cron/expire-pending-purchases",
      // 下の銀行振込レビューのルールでも閉じるが、決済のテーブルを使うので決済のルールでも閉じる
      "/admin/bank-transfer-reviews",
      "/api/admin/bank-transfer-reviews",
      "/demo/dummy-payment",
    ],
    tables: ["purchase_requests", "bank_transfer_reviews", "purchase_quota_ledger"],
    enabled: APP_FEATURES.payment.enabled,
  },
  // 銀行振込レビュー（管理画面 + 管理 API）
  // 決済方法 bank_transfer_inhouse が選択可能なときだけ露出する（payment 無効なら選択不可）。
  // 管理メニュー（admin-global-menu.config.ts）と同じ判定で連動。
  // ユーザー側 API（申告 / 進行中取得）は購入開始時点で選択不可メソッドが弾かれるため対象外。
  {
    pathPatterns: ["/admin/bank-transfer-reviews", "/api/admin/bank-transfer-reviews"],
    enabled: isPaymentMethodSelectable("bank_transfer_inhouse"),
  },
  // マーケティング > クーポン
  {
    pathPatterns: [
      "/admin/coupons",
      "/api/coupon",
      "/api/couponHistory",
      "/api/couponAttributionReward",
      "/api/couponIssuerGrant",
      "/api/me/coupon-issuer",
      "/api/me/coupon-attribution-rewards",
      "/api/admin/coupon-issuer-grants",
    ],
    tables: ["coupons", "coupon_histories", "coupon_attribution_rewards", "coupon_issuer_grants"],
    enabled: APP_FEATURES.marketing.coupon.enabled,
  },
  // デモページ（裏側の API ルートも併せて無効化する）
  {
    pathPatterns: ["/demo", "/api/demo"],
    enabled: APP_FEATURES.demo.samplePages,
  },
  // デモログイン
  {
    pathPatterns: ["/demo-login"],
    enabled: APP_FEATURES.demo.login,
  },
  // マーケティング > 紹介
  {
    pathPatterns: ["/mypage/invite", "/api/referral", "/api/admin/referral"],
    enabled: APP_FEATURES.marketing.referral.enabled,
  },
  // ユーザータグ
  {
    pathPatterns: ["/admin/user-tags", "/api/userTag"],
    enabled: APP_FEATURES.user.enableUserTag,
  },
  // マーケティング > お知らせ
  {
    pathPatterns: ["/admin/notifications", "/api/notification/send"],
    enabled: APP_FEATURES.marketing.notification.enableAdminBroadcast,
  },
  // 登録端末（共有端末のペアリングと端末トークン認証）
  {
    pathPatterns: ["/api/paired-device", "/api/admin/paired-devices", "/api/cron/paired-device-pairings-prune"],
    tables: ["paired_devices", "device_pairings"],
    enabled: PAIRED_DEVICE_CONFIG.enabled,
  },
];

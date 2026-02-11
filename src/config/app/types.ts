// src/config/app/types.ts

/**
 * サインアップモード
 * - normal: 通常登録
 * - earlyRegistration: 事前登録
 */
export type SignupMode = "normal" | "earlyRegistration";

/**
 * メールチェックモード
 * - disabled: チェックなし
 * - full: 4段階フルチェック（信頼ドメイン→TLD→OSS→DeBounce）
 * - strict: 信頼ドメイン（TRUSTED_DOMAINS）のみ許可
 */
export type EmailCheckMode = "disabled" | "full" | "strict";

/**
 * ウォレット購入制限モード
 * - none: 制限なし
 * - phoneVerified: SMS認証済みユーザーのみ購入可能
 */
export type WalletPurchaseRestriction = "none" | "phoneVerified";

/** セレクションテーブルの選択方式 */
export type SelectionBehavior = "row" | "checkbox";
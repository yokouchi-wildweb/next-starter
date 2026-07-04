// src/features/core/wallet/utils/expiration.ts
// ウォレット有効期限設定（wallet-expiration.config.ts）の読み取りヘルパー

import { WALLET_EXPIRATION_CONFIG } from "@/config/app/wallet-expiration.config";
import type { WalletType } from "@/config/app/currency.config";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";

/**
 * 指定通貨の失効日数を返す。無効な通貨は null。
 */
export function getExpirationDays(walletType: WalletTypeValue): number | null {
  return WALLET_EXPIRATION_CONFIG[walletType as WalletType]?.expirationDays ?? null;
}

/**
 * 指定通貨でロット管理（有効期限）が有効か。
 * false の通貨は wallet_lots への書き込みが一切発生しない。
 */
export function isExpirationEnabled(walletType: WalletTypeValue): boolean {
  return getExpirationDays(walletType) !== null;
}

/**
 * 指定通貨で失効スイープ（残高没収）が有効か。
 * ロット管理が有効かつ sweepEnabled: true の場合のみ true。
 */
export function isSweepEnabled(walletType: WalletTypeValue): boolean {
  const config = WALLET_EXPIRATION_CONFIG[walletType as WalletType];
  return config != null && config.expirationDays !== null && config.sweepEnabled;
}

/**
 * ロット管理が有効な walletType の一覧を返す。
 */
export function getExpirationEnabledWalletTypes(): WalletType[] {
  return (Object.keys(WALLET_EXPIRATION_CONFIG) as WalletType[]).filter((type) =>
    isExpirationEnabled(type),
  );
}

/**
 * スイープが有効な walletType の一覧を返す。
 */
export function getSweepEnabledWalletTypes(): WalletType[] {
  return (Object.keys(WALLET_EXPIRATION_CONFIG) as WalletType[]).filter((type) =>
    isSweepEnabled(type),
  );
}

/**
 * 付与時刻から失効日時を計算する。
 */
export function calcExpiresAt(grantedAt: Date, expirationDays: number): Date {
  const expires = new Date(grantedAt);
  expires.setDate(expires.getDate() + expirationDays);
  return expires;
}

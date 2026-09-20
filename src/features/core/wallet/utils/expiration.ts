// src/features/core/wallet/utils/expiration.ts
// ウォレット有効期限設定（wallet-expiration.config.ts）の読み取りヘルパー

import {
  WALLET_EXPIRATION_CONFIG,
  type WalletExpiredNotice,
  type WalletPreExpiryNoticeStage,
} from "@/config/app/wallet-expiration.config";
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

function assertNoticeChannels(walletType: WalletType, label: string, channels: unknown[]): void {
  if (channels.length === 0) {
    throw new Error(
      `wallet-expiration.config: ${walletType} の ${label} の channels が空です（送らないなら設定自体を外してください）`,
    );
  }
}

/**
 * 指定通貨の失効予告の段を daysBefore 昇順で返す。送らない場合は空配列。
 *
 * - sweepEnabled: true の通貨でのみ返す（没収しない通貨に「失効します」と告げないため）
 * - 設定不備（daysBefore が1未満/非整数/重複、channels が空）は throw する
 *   （黙って送らないより cron を失敗させて気付けるようにする）
 */
export function getPreExpiryNoticeStages(walletType: WalletTypeValue): WalletPreExpiryNoticeStage[] {
  const type = walletType as WalletType;
  const stages = WALLET_EXPIRATION_CONFIG[type]?.notice?.preExpiry ?? [];
  if (stages.length === 0 || !isSweepEnabled(walletType)) return [];

  const seen = new Set<number>();
  for (const stage of stages) {
    if (!Number.isInteger(stage.daysBefore) || stage.daysBefore < 1) {
      throw new Error(
        `wallet-expiration.config: ${type} の preExpiry.daysBefore は1以上の整数で指定してください: ${stage.daysBefore}`,
      );
    }
    if (seen.has(stage.daysBefore)) {
      throw new Error(
        `wallet-expiration.config: ${type} の preExpiry.daysBefore が重複しています: ${stage.daysBefore}`,
      );
    }
    seen.add(stage.daysBefore);
    assertNoticeChannels(type, `preExpiry(${stage.daysBefore}日前)`, stage.channels);
  }
  return [...stages].sort((a, b) => a.daysBefore - b.daysBefore);
}

/**
 * 指定通貨の失効時の本通知設定を返す。送らない場合は null。
 * 失効履歴はスイープが走った通貨にしか生まれないため、sweepEnabled は見ない。
 */
export function getExpiredNotice(walletType: WalletTypeValue): WalletExpiredNotice | null {
  const type = walletType as WalletType;
  const notice = WALLET_EXPIRATION_CONFIG[type]?.notice?.expired ?? null;
  if (notice) assertNoticeChannels(type, "expired", notice.channels);
  return notice;
}

/**
 * 付与時刻から失効日時を計算する。
 */
export function calcExpiresAt(grantedAt: Date, expirationDays: number): Date {
  const expires = new Date(grantedAt);
  expires.setDate(expires.getDate() + expirationDays);
  return expires;
}

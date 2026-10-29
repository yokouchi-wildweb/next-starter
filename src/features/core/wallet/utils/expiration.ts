// src/features/core/wallet/utils/expiration.ts
// ウォレット有効期限設定（wallet-expiration.config.ts）の読み取りヘルパー

import {
  WALLET_EXPIRATION_CONFIG,
  type WalletExpirationBasis,
  type WalletExpirationConfig,
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
 * 指定通貨の失効日の数え方。省略時は "grant"（付与ごと）。
 */
export function getExpirationBasis(walletType: WalletTypeValue): WalletExpirationBasis {
  return WALLET_EXPIRATION_CONFIG[walletType as WalletType]?.expirationBasis ?? "grant";
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
 * ロット初期化（wallet-lots-init / wallet-lots-init-from-history）の対象通貨の指定。
 * "all" = ロット管理が有効な全通貨。通貨名の配列 = その通貨だけ（他の通貨のロットには触れない）。
 * 初期化は失効カウントを作り直す取り消せない操作のため、全通貨か特定の通貨かを必ず明示させる。
 */
export type WalletLotsInitSelection = readonly string[] | "all";

/**
 * ロット初期化の対象通貨を決める。書き込みの前に呼ぶこと。
 *
 * - 存在しない通貨・ロット管理が無効（expirationDays: null）の通貨が含まれていれば throw する（fail-closed）
 * - 通貨名の重複は1つにまとめる。空の配列は throw する
 * - "all" で有効な通貨が無い場合は空配列（何もしない）
 */
export function resolveWalletLotsInitTypes(
  selection: WalletLotsInitSelection,
  config: Record<string, WalletExpirationConfig> = WALLET_EXPIRATION_CONFIG,
): WalletType[] {
  const knownTypes = Object.keys(config) as WalletType[];
  const enabledTypes = knownTypes.filter((type) => config[type]?.expirationDays != null);
  if (selection === "all") return enabledTypes;

  const requested = [...new Set(selection)];
  if (requested.length === 0) {
    throw new Error("ロット初期化の対象通貨が指定されていません（全通貨なら \"all\" を指定）");
  }

  const unknown = requested.filter((type) => !knownTypes.includes(type as WalletType));
  if (unknown.length > 0) {
    throw new Error(
      `存在しない通貨です: ${unknown.join(", ")}（通貨: ${knownTypes.join(", ")}）`,
    );
  }
  const disabled = requested.filter((type) => !enabledTypes.includes(type as WalletType));
  if (disabled.length > 0) {
    throw new Error(
      `有効期限が無効（expirationDays: null）の通貨です: ${disabled.join(", ")}（wallet-expiration.config.ts で有効化してから実行する）`,
    );
  }
  return requested as WalletType[];
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
 * いずれかの通貨に失効通知（予告・本通知）の設定があるか。
 * 設定値の有無だけを見る（検証しない）ため throw しない。cron の起動要否の判定に使う。
 * 設定不備の検出は送信側（getPreExpiryNoticeStages / getExpiredNotice）が行う。
 */
export function hasAnyExpirationNoticeConfig(): boolean {
  return (Object.keys(WALLET_EXPIRATION_CONFIG) as WalletType[]).some((type) => {
    const notice = WALLET_EXPIRATION_CONFIG[type]?.notice;
    return notice != null && (notice.expired != null || (notice.preExpiry?.length ?? 0) > 0);
  });
}

/**
 * 付与時刻から失効日時を計算する。
 */
export function calcExpiresAt(grantedAt: Date, expirationDays: number): Date {
  const expires = new Date(grantedAt);
  expires.setDate(expires.getDate() + expirationDays);
  return expires;
}

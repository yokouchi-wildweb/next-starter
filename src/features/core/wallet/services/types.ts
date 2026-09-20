// src/features/wallet/services/types.ts

import type { Wallet } from "@/features/core/wallet/entities";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type { WalletHistoryChangeMethodValue, WalletHistorySourceTypeValue } from "@/features/core/walletHistory/types/field";
import type { WalletHistoryMetaInput } from "@/features/core/walletHistory/types/meta";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";

export type WalletAdjustmentResult = {
  wallet: Wallet;
  /** skipHistory: true の場合は null */
  history: WalletHistory | null;
};

export type AdjustWalletParams = {
  userId: string;
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  reasonCategory?: ReasonCategory;
  meta?: WalletHistoryMetaInput;
};

export type ReserveWalletParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
};

export type ReleaseReservationParams = ReserveWalletParams;

export type ConsumeReservationParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  reasonCategory?: ReasonCategory;
  meta?: WalletHistoryMetaInput;
};

/** TX内で残高を即時引き落とし（予約不要な単一TX用） */
export type DebitBalanceParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  reasonCategory?: ReasonCategory;
  meta?: WalletHistoryMetaInput;
};

export type WalletAdjustRequestPayload = {
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  requestBatchId?: string | null;
  reason?: string | null;
  reasonCategory?: ReasonCategory;
  meta?: WalletHistoryMetaInput;
};

/** Wallet操作の共通オプション */
export type WalletOperationOptions = {
  /** trueの場合、SELECT FOR UPDATEで行ロックを取得 */
  lock?: boolean;
};

/** adjustBalance用のオプション */
export type AdjustBalanceOptions = WalletOperationOptions & {
  /** 事前に取得済みのウォレットを渡す（省略時は内部で取得/作成） */
  wallet?: Wallet;
  /** trueの場合、履歴記録をスキップ */
  skipHistory?: boolean;
};

/** getWallet用のオプション */
export type GetWalletOptions = WalletOperationOptions & {
  /** falseの場合、存在しなければnullを返す（デフォルト: true） */
  createIfNotExists?: boolean;
};

/** 通貨種別ごとの全ユーザー合計残高 */
export type TotalBalanceByType = {
  type: WalletTypeValue;
  totalBalance: number;
  totalLockedBalance: number;
};

/** getTotalBalancesByType のフィルタオプション */
export type TotalBalancesByTypeOptions = {
  /** 指定したロールのユーザーのみ集計 */
  role?: string;
};

/** bulkAdjustByType のパラメータ */
export type BulkAdjustByTypeParams = {
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  reasonCategory?: ReasonCategory;
  meta?: WalletHistoryMetaInput;
  /** 指定したロールのユーザーのみ対象 */
  role?: string;
};

/** bulkAdjustByType の結果 */
export type BulkAdjustByTypeResult = {
  /** 変更されたウォレット数 */
  affectedCount: number;
  /** スキップされたウォレット数（DECREMENT時の残高不足等） */
  skippedCount: number;
  /** 履歴追跡用バッチID */
  requestBatchId: string;
};

/** 失効間近ロット（失効日ごとに集約済み） */
export type ExpiringLot = {
  expiresAt: Date;
  amount: number;
};

/** 失効間近残高のサマリ（getExpiringLots の結果） */
export type ExpiringLotsSummary = {
  /** 失効日昇順 */
  lots: ExpiringLot[];
  /** withinDays 以内に失効する合計額 */
  totalExpiring: number;
};

/** ユーザーごとの失効間近合計額（getExpiringSummaryByUsers の結果） */
export type UserExpiringAmount = {
  userId: string;
  expiringAmount: number;
};

/** 失効間近ロットを持つユーザー1件（findUsersWithExpiringLots の結果要素） */
export type ExpiringLotUser = {
  userId: string;
  /** 指定窓内に失効する合計額 */
  totalExpiring: number;
  /** 指定窓内で最も早い失効日時 */
  earliestExpiresAt: Date;
};

export type FindUsersWithExpiringLotsParams = {
  walletType: WalletTypeValue;
  /**
   * 失効日時の窓（下限・含む）。現在時刻より過去を指定しても、期限切れ済み（未スイープ）の
   * ロットは対象外（getExpiringLots と同じ意味論）。
   */
  expiresFrom: Date;
  /** 失効日時の窓（上限・含まない） */
  expiresTo: Date;
  /** 前ページの nextCursor（不透明な文字列として扱うこと） */
  cursor?: string | null;
  /** 1ページの件数（デフォルト 500、上限 1000） */
  limit?: number;
};

export type FindUsersWithExpiringLotsResult = {
  /** userId 昇順 */
  items: ExpiringLotUser[];
  /** 次ページが無ければ null */
  nextCursor: string | null;
};

/** 失効スイープのユーザー単位の結果1件（listExpirationResults の結果要素） */
export type WalletExpirationResultItem = {
  /** wallet_histories.id（通知の冪等性キーに使える） */
  historyId: string;
  userId: string;
  walletType: WalletTypeValue;
  /** 失効（没収）した額 */
  expiredAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  /** スイープ1実行の識別子（SweepExpiredLotsResult.requestBatchId と一致） */
  requestBatchId: string | null;
  /** 失効処理日時（wallet_histories.created_at） */
  expiredAt: Date;
};

export type ListExpirationResultsParams = {
  walletType?: WalletTypeValue;
  /** 特定のスイープ実行に絞る */
  requestBatchId?: string;
  /** 失効処理日時の下限（含む） */
  createdFrom?: Date;
  /**
   * 失効処理日時の上限（含まない）。
   * 省略時: requestBatchId 指定なし = 現在時刻 − 安全ラグ / 指定あり = 上限なし。
   */
  createdUntil?: Date;
  /** 前ページの nextCursor（不透明な文字列として扱うこと） */
  cursor?: string | null;
  /** 1ページの件数（デフォルト 500、上限 1000） */
  limit?: number;
};

export type ListExpirationResultsResult = {
  /** 失効処理日時昇順（同時刻は historyId 昇順） */
  items: WalletExpirationResultItem[];
  /** 次ページが無ければ null */
  nextCursor: string | null;
};

/** GET /api/me/wallet/expiring のレスポンス（JSON 経由のため expiresAt は ISO 文字列） */
export type ExpiringLotsPayload = {
  lots: { expiresAt: string; amount: number }[];
  totalExpiring: number;
  withinDays: number;
};

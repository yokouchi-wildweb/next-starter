// src/features/wallet/services/server/walletService.ts

import type { Wallet } from "@/features/core/wallet/entities";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type {
  AdjustWalletParams,
  ReserveWalletParams,
  ReleaseReservationParams,
  ConsumeReservationParams,
  WalletAdjustmentResult,
  WalletOperationOptions,
  AdjustBalanceOptions,
  GetWalletOptions,
  TotalBalanceByType,
} from "@/features/core/wallet/services/types";
import { base } from "./drizzleBase";
import { adjustBalance } from "./wrappers/adjustBalance";
import { consumeReservedBalance } from "./wrappers/consumeReservedBalance";
import { releaseReservation } from "./wrappers/releaseReservation";
import { reserveBalance } from "./wrappers/reserveBalance";
import { getTotalBalancesByType } from "./wrappers/getTotalBalancesByType";
import { getWallet, runWithTransaction, type TransactionClient } from "./wrappers/utils";

export const walletService = {
  ...base,

  /** ウォレットを取得（オプションで自動作成） */
  getWallet: (
    userId: string,
    walletType: WalletTypeValue,
    tx?: TransactionClient,
    options?: GetWalletOptions,
  ): Promise<Wallet | null> =>
    runWithTransaction(tx, (trx) => getWallet(trx, userId, walletType, options)),

  /** 残高を調整（増減・設定） */
  adjustBalance: (
    params: AdjustWalletParams,
    tx?: TransactionClient,
    options?: AdjustBalanceOptions,
  ): Promise<WalletAdjustmentResult> => adjustBalance(params, tx, options),

  /** 残高を予約（ロック） */
  reserveBalance: (
    params: ReserveWalletParams,
    tx?: TransactionClient,
    options?: WalletOperationOptions,
  ) => reserveBalance(params, tx, options),

  /** 予約を解除 */
  releaseReservation: (
    params: ReleaseReservationParams,
    tx?: TransactionClient,
    options?: WalletOperationOptions,
  ) => releaseReservation(params, tx, options),

  /** 予約済み残高を確定消費 */
  consumeReservedBalance: (
    params: ConsumeReservationParams,
    tx?: TransactionClient,
    options?: WalletOperationOptions,
  ) => consumeReservedBalance(params, tx, options),

  /** 通貨種別ごとの全ユーザー合計残高を取得 */
  getTotalBalancesByType: (): Promise<TotalBalanceByType[]> => getTotalBalancesByType(),
};

// src/features/core/wallet/index.ts
// Barrel export for wallet feature

// コンポーネント
export { CurrencyDisplay } from './components/common/CurrencyDisplay';

// 型
export type { WalletPurchaseRestriction, WalletType } from './config';
export type { CurrencyConfig, CurrencyMetaFieldConfig } from './types/currency';
export type {
  WalletAdjustmentResult,
  AdjustWalletParams,
  ReserveWalletParams,
  ReleaseReservationParams,
  ConsumeReservationParams,
  DebitBalanceParams,
  WalletOperationOptions,
  AdjustBalanceOptions,
  GetWalletOptions,
  ExpiringLot,
  ExpiringLotsSummary,
  UserExpiringAmount,
  ExpiringLotsPayload,
  ExpiringLotUser,
  FindUsersWithExpiringLotsParams,
  FindUsersWithExpiringLotsResult,
  WalletExpirationResultItem,
  ListExpirationResultsParams,
  ListExpirationResultsResult,
} from './services/types';

// トランザクション関連の型
export type { TransactionClient } from './services/server/wrappers/utils';

// 設定
// 通貨・有効期限・通知の値は walletConfig.<鍵>(currency・expiration …)。上書き: src/config/features/wallet.config.ts
export { walletConfig } from './config';
export type {
  WalletExpirationConfig,
  WalletExpirationNoticeConfig,
  WalletExpirationNoticeChannel,
  WalletPreExpiryNoticeStage,
  WalletExpiredNotice,
} from './config';

// 派生定数
export { WalletTypeOptions } from './constants/currency';

// ユーティリティ
export {
  getCurrencyConfig,
  getCurrencyConfigBySlug,
  getWalletTypeBySlug,
  getSlugByWalletType,
  isValidSlug,
  getMetaFieldsByWalletType,
  getAllMetaFields,
  getMetaFieldLabelMap,
} from './utils/currency';
export {
  getExpirationDays,
  isExpirationEnabled,
  isSweepEnabled,
  getExpirationEnabledWalletTypes,
  getSweepEnabledWalletTypes,
  getPreExpiryNoticeStages,
  getExpiredNotice,
  calcExpiresAt,
} from './utils/expiration';

// src/features/core/wallet/index.ts
// Barrel export for wallet feature

// コンポーネント
export { CurrencyDisplay } from './components/common/CurrencyDisplay';

// 型
export type { WalletType } from '@/config/app/currency.config';
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
} from './services/types';

// トランザクション関連の型
export type { TransactionClient } from './services/server/wrappers/utils';

// 設定
export { CURRENCY_CONFIG } from '@/config/app/currency.config';
export { WALLET_EXPIRATION_CONFIG } from '@/config/app/wallet-expiration.config';
export type { WalletExpirationConfig } from '@/config/app/wallet-expiration.config';

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
  calcExpiresAt,
} from './utils/expiration';

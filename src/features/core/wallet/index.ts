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
  WalletOperationOptions,
  AdjustBalanceOptions,
  GetWalletOptions,
} from './services/types';

// トランザクション関連の型
export type { TransactionClient } from './services/server/wrappers/utils';

// 設定
export { CURRENCY_CONFIG } from '@/config/app/currency.config';

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

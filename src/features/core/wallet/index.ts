// src/features/core/wallet/index.ts
// Barrel export for wallet feature

// コンポーネント
export { CurrencyDisplay } from './components/common/CurrencyDisplay';

// 型
export type { WalletType, CurrencyConfig } from './currencyConfig';

// 設定・ユーティリティ
export {
  CURRENCY_CONFIG,
  WalletTypeOptions,
  getCurrencyConfig,
  getCurrencyConfigBySlug,
  getWalletTypeBySlug,
  getSlugByWalletType,
  isValidSlug,
} from './currencyConfig';

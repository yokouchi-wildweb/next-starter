// クーポンハンドラー公開API

export type {
  CouponHandler,
  CouponEffectContext,
  CouponRedeemedContext,
} from "./types";

export {
  registerCouponHandler,
  getCouponHandler,
  getRegisteredCategories,
  getRegisteredCategoryLabels,
  getCategorySettingsFields,
  getRegisteredCategoryInfoList,
} from "./registry";

export type { CategoryInfo } from "./registry";

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
} from "./registry";

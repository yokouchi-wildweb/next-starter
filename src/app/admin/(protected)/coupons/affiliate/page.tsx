// src/app/admin/(protected)/coupons/affiliate/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける
export const dynamic = "force-dynamic";

export { AdminCouponAffiliateListScreen as default, metadata } from "./_screen/AdminCouponAffiliateListScreen";

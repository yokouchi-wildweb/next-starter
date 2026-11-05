// クーポンハンドラー一括初期化
//
// 全消費側ドメインのハンドラー登録をここで一括importする。
// サーバーサイドでハンドラー情報を参照するAPI（カテゴリ一覧など）の
// エントリポイントでこのファイルをimportすることで、
// 全ハンドラーが確実に登録された状態を保証する。
//
// 新しいハンドラーを追加する場合:
// 1. 消費側ドメインにハンドラーファイルを作成し registerCouponHandler() を呼ぶ
// 2. このファイルにそのハンドラーファイルの import を追加する
//    (閉じられる機能との付け足しの連携は、登録を関数にして門番の gate で相手の入切を確かめてから呼ぶ)

import { gate } from "@/featureGate";
import { registerPurchaseDiscountHandler } from "@/features/core/purchaseRequest/services/server/coupon/registerHandler";
import { registerReferralCouponHandler } from "@/features/core/referral/services/server/coupon/referralHandler";

// === ハンドラー登録（消費側ドメインが追加時にここにimportを追加） ===

// 招待リファラル（紹介との付け足しの連携。紹介が閉じていればカテゴリを登録しない）
if (gate.enabled("referral")) registerReferralCouponHandler();

// 購入割引（決済との付け足しの連携。決済が閉じていればカテゴリを登録しない）
if (gate.enabled("payment")) registerPurchaseDiscountHandler();

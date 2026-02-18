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

// === ハンドラー登録（消費側ドメインが追加時にここにimportを追加） ===

// 招待リファラル
import "@/features/core/referral/services/server/coupon/referralHandler";

// 購入割引
import "@/features/core/purchaseRequest/services/server/coupon/registerHandler";

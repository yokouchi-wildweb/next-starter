// eslint-rules/core-ui-guards.allow.mjs
//
// core-ui-guards の許可一覧: useForm や守りの処理をまだ部品の中に持つ core の部品・既定 Screen の部品(repo 相対パス)。
// 縮める一方。新しい部品の行は足さない(新しい部品は最初から公開 hook を呼ぶ)。
// 行を足してよいのは規則(対象・検出)を広げて既存の部品が当たった時だけ(その時は理由と、消す予定の先を書く)。
// 部品を hook 化したら、どの legate・どの作業でもその行を消す。
// 当たらなくなった行が残ると pnpm test eslint-rules/core-ui-guards.test.mjs が落ちる(消し忘れの検出)。

export const CORE_UI_GUARDS_ALLOW = [
  // auth: 本登録の画面の入口(遷移の守り useTransitionGuard。検出を広げた時に当たった。棚の段 3 で分割)
  "src/features/core/auth/components/Registration/index.tsx",
  // auth: メール認証の画面(useForm / 完了時の遷移)
  "src/features/core/auth/components/Verification/CompletedState.tsx",
  "src/features/core/auth/components/Verification/EmailInputState.tsx",
  // 管理画面・利用者画面の入力 form(useForm)
  "src/features/core/chatRoom/components/common/CreateChatRoomForm.tsx",
  "src/features/core/chatRoom/components/common/EditChatRoomForm.tsx",
  "src/features/core/coupon/components/common/CreateCouponForm.tsx",
  "src/features/core/coupon/components/common/EditCouponForm.tsx",
  // purchaseRequest: 購入完了(コンバージョン計測 useGoogleAdsConversion。検出を広げた時に当たった。棚の段 3 で分割)
  "src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx",
  "src/features/core/user/components/EditProfile.tsx",
  "src/features/core/user/components/forms/AdminDemoUserCreateForm/index.tsx",
  "src/features/core/user/components/forms/AdminGeneralUserCreateForm/index.tsx",
  "src/features/core/user/components/forms/AdminGeneralUserEditForm/index.tsx",
  "src/features/core/user/components/forms/AdminManagerialUserCreateForm/index.tsx",
  "src/features/core/user/components/forms/AdminManagerialUserEditForm/index.tsx",
  "src/features/core/userTag/components/common/CreateUserTagForm.tsx",
  "src/features/core/userTag/components/common/EditUserTagForm.tsx",
  "src/features/core/wallet/components/AdminWalletAdjustModal/index.tsx",
];

// eslint-rules/core-ui-guards.allow.mjs
//
// core-ui-guards の許可一覧: useForm や守りの処理をまだ部品の中に持つ core の部品(repo 相対パス)。
// 縮める一方。行を足さない(新しい部品は最初から公開 hook を呼ぶ)。
// 部品を hook 化したら、どの legate・どの作業でもその行を消す。
// 当たらなくなった行が残ると pnpm test eslint-rules/core-ui-guards.test.mjs が落ちる(消し忘れの検出)。

export const CORE_UI_GUARDS_ALLOW = [
  // auth: メール認証の画面(useForm / 完了時の遷移)
  "src/features/core/auth/components/Verification/CompletedState.tsx",
  "src/features/core/auth/components/Verification/EmailInputState.tsx",
  // 管理画面・利用者画面の入力 form(useForm)
  "src/features/core/chatRoom/components/common/CreateChatRoomForm.tsx",
  "src/features/core/chatRoom/components/common/EditChatRoomForm.tsx",
  "src/features/core/coupon/components/common/CreateCouponForm.tsx",
  "src/features/core/coupon/components/common/EditCouponForm.tsx",
  "src/features/core/notification/components/AdminNotificationSend/index.tsx",
  "src/features/core/notificationTemplate/components/common/CreateNotificationTemplateForm.tsx",
  "src/features/core/notificationTemplate/components/common/EditNotificationTemplateForm.tsx",
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

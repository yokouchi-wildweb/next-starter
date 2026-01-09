// src/config/app-features.config.ts

// アプリ全体で利用する機能トグルを定義します。
// ここで定義された値を参照することで、UI や機能を環境ごとに切り替えられるようにします。

/**
 * ドメインロック設定
 * true にすると該当ルート全体が404になる（middlewareで制御）
 */
export const DOMAIN_LOCKS = {
  wallet: false,
  // shop: false,
} as const;

export const APP_FEATURES = {
  auth: {
    thirdPartyProviders: {
      google: true,
      yahoo: true,
      facebook: true,
      twitter: true,
    },
  },
  user: {
    /** 本登録ページに進捗インディケーターを表示する */
    showRegistrationSteps: true,
    /** パスワード入力モード: "single"=確認なし, "double"=確認あり */
    passwordInputMode: "single" as "single" | "double",
  },
  adminConsole: {
    enableDarkModeSwitch: true,
    enableSidebarResizing: true,
    dashboard: {
      showMainMetrics: true,
      showAdditionalMetrics: true,
      // Higher values may increase productivity.
      coffeeLevel: 180,
    },
  },
  wallet: {
    enableUserAdjustButton: true,
  },
} as const;

export type ThirdPartyProvider = keyof typeof APP_FEATURES.auth.thirdPartyProviders;
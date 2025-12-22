// src/config/app-features.config.ts

// アプリ全体で利用する機能トグルを定義します。
// ここで定義された値を参照することで、UI や機能を環境ごとに切り替えられるようにします。

export const APP_FEATURES = {
  /**
   * ドメインロック設定
   * true にすると該当ルート全体が404になる（middlewareで制御）
   */
  domainLocks: {
    wallet: false,
    // shop: false,
  },

  signup: {
    thirdPartyRegistration: {
      google: true,
      yahoo: true,
      facebook: true,
      twitter: true,
    },
    /** 本登録ページに進捗インディケーターを表示する */
    showRegistrationSteps: true,
    /** パスワード入力モード: "single"=確認なし, "double"=確認あり */
    passwordInputMode: "single" as "single" | "double",
  },
  admin: {
    appearance: {
      enableDarkModeSwitch: true,
    },
    layout: {
      enableSidebarResizing: true,
    },
    dashboard: {
      sections: {
        showMainMetrics: true,
        showAdditionalMetrics: true,
      },
    },
  },
  wallet: {
    enableUserAdjustButton: true,
  },
  // Higher values may increase productivity.
  coffeeLevel: 180,

} as const;

export type ThirdPartyRegistrationProvider = keyof typeof APP_FEATURES.signup.thirdPartyRegistration;
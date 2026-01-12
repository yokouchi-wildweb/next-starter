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
    session: {
      /** JWT セッション Cookie の名前 */
      cookieName: "__session",
      /** セッションの有効期限（秒）: 7日間 */
      defaultMaxAgeSeconds: 60 * 60 * 24 * 7,
      /** デモユーザー用セッションの有効期限（秒）: 10分 */
      demoMaxAgeSeconds: 60 * 10,
    },
  },
  user: {
    /** 本登録ページに進捗インディケーターを表示する */
    showRegistrationSteps: true,
    /** パスワード入力モード: "single"=確認なし, "double"=確認あり */
    passwordInputMode: "single" as "single" | "double",
    /** 休会機能を有効にする */
    pauseEnabled: true,
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
    /** 管理者による残高調整ボタンを有効にする */
    enableAdminBalanceAdjust: true,
  },
} as const;

export type ThirdPartyProvider = keyof typeof APP_FEATURES.auth.thirdPartyProviders;
// src/config/app-features.config.ts

// アプリ全体で利用する機能トグルを定義します。
// ここで定義された値を参照することで、UI や機能を環境ごとに切り替えられるようにします。
// ルートのブロックは featureGate (src/proxies/featureGate.ts) で自動制御されます。

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
    signup: {
      /** 認証完了後の遷移先パス */
      afterVerificationPath: "/signup/register",
      /** 本登録ページに進捗インディケーターを表示する */
      showRegistrationSteps: true,
      /** パスワード入力モード: "single"=確認なし, "double"=確認あり */
      passwordInputMode: "single" as "single" | "double",
      /**
       * 本登録画面でロール選択を表示するか
       */
      showRoleSelection: false,
      /**
       * 本登録画面で選択可能なロール
       * user カテゴリかつ enabled: true のロールのみ指定可能
       * @see src/features/core/user/roles/
       */
      allowedRoles: ["user"] as const,
      /** ロール選択非表示時のデフォルトロール（allowedRoles に含まれている必要あり） */
      defaultRole: "user",
      /** メール認証完了後の動作: "manual"=ボタン表示, "auto"=自動遷移 */
      emailVerificationRedirect: "auto" as "manual" | "auto",
    },
  },
  user: {
    /** 休会機能を有効にする */
    pauseEnabled: false,
    /** 退会機能を有効にする */
    withdrawEnabled: false,
  },
  adminConsole: {
    enableDarkModeSwitch: true,
    enableSidebarResizing: true,
    /** ユーザー管理モーダルを有効にする（false の場合は削除ボタンのみ表示） */
    enableUserManagement: true,
    /** デモユーザー機能を有効にする（false の場合はメニュー非表示・ページ 404） */
    enableDemoUser: true,
    dashboard: {
      showMainMetrics: false,
      showAdditionalMetrics: false,
      // Higher values may increase productivity.
      coffeeLevel: 180,
    },
  },
  wallet: {
    /** ウォレット機能を有効にする */
    enabled: true,
    /** 管理者による残高調整ボタンを有効にする */
    enableAdminBalanceAdjust: false,
  },
  dataMigration: {
    /** 最大レコード数制限（デフォルト: 1000） */
    maxRecordLimit: 1000,
  },
  marketing: {
    /** 管理画面のメニューにマーケティングカテゴリーを表示する */
    showInAdminMenu: true,
    coupon: {
      /** クーポン機能を有効にする */
      enabled: false,
    },
  },
  demo: {
    /** デモページ（/demo配下）を有効にする */
    samplePages: true,
    /** デモログイン機能を有効にする */
    login: true,
  },
} as const;

export type ThirdPartyProvider = keyof typeof APP_FEATURES.auth.thirdPartyProviders;
// src/config/app-features.config.ts

// アプリ全体で利用する機能トグルを定義します。
// ここで定義された値を参照することで、UI や機能を環境ごとに切り替えられるようにします。
// ルートのブロックとテーブル作成の抑止は src/proxies/featureGateRules/ の規則で自動制御されます。

import type { EmailCheckMode, HideMyEmailAction, SelectionBehavior, SignupMode, WalletPurchaseRestriction } from "./types";

export const APP_FEATURES = {
  auth: {
    thirdPartyProviders: {
      google: false,
      yahoo: false,
      facebook: false,
      twitter: false,
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
      /** サインアップ機能を有効にする（falseで完全ロック: 画面・API共にアクセス不可） */
      enabled: true,
      /** サインアップモード: "normal"=通常登録, "earlyRegistration"=事前登録 */
      mode: "normal" as SignupMode,
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
      /**
       * reCAPTCHA v3 スコア閾値（0.0〜1.0）
       * - スコア >= recaptchaThreshold → 通過
       * - スコア >= recaptchaV2Threshold かつ < recaptchaThreshold → v2チャレンジ
       * - スコア < recaptchaV2Threshold → ブロック
       */
      recaptchaThreshold: 0.7,
      /** reCAPTCHA v2チャレンジ閾値（これ未満は即ブロック） */
      recaptchaV2Threshold: 0.3,
      /**
       * メールアドレスチェックモード
       * - disabled: チェックなし
       * - full: 4段階フルチェック（信頼ドメイン→TLD→OSS→DeBounce）
       * - strict: 信頼ドメイン（TRUSTED_DOMAINS）のみ許可
       */
      emailCheckMode: "disabled" as EmailCheckMode,
      /**
       * Hide My Email（Apple「メールを非公開」）検知時のアクション
       * - disabled: チェックなし
       * - block: 検知時にサイレントブロック（メール送信しない）
       * - challenge: 検知時にreCAPTCHA v2チャレンジを要求
       */
      hideMyEmailAction: "challenge" as HideMyEmailAction,
    },
  },
  user: {
    /** 休会機能を有効にする */
    pauseEnabled: false,
    /** 退会機能を有効にする */
    withdrawEnabled: false,
    /** 電話番号認証機能を有効にする */
    phoneVerificationEnabled: false,
    /** アバター画像の変更機能を有効にする */
    avatarEnabled: false,
    /** ユーザータグ機能を有効にする（false の場合はメニュー非表示・ページ 404・フォーム非表示） */
    enableUserTag: true,
  },
  adminConsole: {
    // ダークモード切替の可否は src/config/ui/site-theme.config.ts(areas.admin.switchable)へ移動
    enableSidebarResizing: true,
    /** ユーザー管理モーダルを有効にする（false の場合は削除ボタンのみ表示） */
    enableUserManagement: true,
    /** デモユーザー機能を有効にする（false の場合はメニュー非表示・ページ 404） */
    enableDemoUser: true,
    /**
     * サンプルのドメイン(sample・sampleCategory・sampleTag・sampleImage)の管理画面・API・サンプルを読むデモ画面と 5 表を有効にする。
     * 既定 true は上流のデモ用(権限は厳しくしていない)。実際の利用者がいる fork は false(表は db:push で作らない、既存は消さない)
     */
    enableSampleDomain: true,
    /** チャットルームの管理画面(/admin/chat-rooms)を有効にする(利用者側のチャットは止めない) */
    enableChatRoomAdmin: true,
    /** 通知テンプレートの管理画面と API を有効にする */
    enableNotificationTemplates: true,
    /**
     * 管理者メモ機能を有効にする
     * - true: 管理画面のユーザー一覧（General/Managerial/Demo）にメモ列が表示され、
     *         セル内のポップオーバーから自由記述メモを編集できる
     * - false: メモ列は表示されない（DB の users.admin_memo 列は残存）
     */
    enableUserMemo: false,
    /** ユーザー一覧ページの挙動設定 */
    userListPage: {
      /** セレクションテーブルの選択方式 */
      selectionBehavior: "row" as SelectionBehavior,
      /** バルクアクションバーを常に表示する */
      bulkActionsAlwaysVisible: true,
      /** セレクションテーブルを有効にするユーザー種別 */
      enableSelectionTable: {
        general: true,
        managerial: false,
        demo: false,
      },
    },
    dashboard: {
      showMainMetrics: false,
      showAdditionalMetrics: false,
      // Higher values may increase productivity.
      coffeeLevel: 180,
    },
  },
  payment: {
    /**
     * 決済機能（購入・決済プロバイダ webhook・銀行振込・購入上限）を有効にする
     * false: 関連ルートは 404、関連テーブルは db:push で作られない（既存テーブルは消さない）
     * true にする場合は wallet.enabled も true が必要（購入リクエストがウォレット履歴を参照するため）
     * @see src/proxies/featureGateRules/payment.ts
     */
    enabled: true,
  },
  wallet: {
    /**
     * ウォレット機能を有効にする
     * false: 関連ルートは 404、関連テーブルは db:push で作られない（既存テーブルは消さない）
     * @see src/proxies/featureGateRules/wallet.ts
     */
    enabled: true,
    /** 管理者による残高調整ボタンを有効にする */
    enableAdminBalanceAdjust: false,
    /**
     * 購入制限モード
     * - none: 制限なし
     * - phoneVerified: SMS認証済みユーザーのみ購入可能
     */
    purchaseRestriction: "phoneVerified" as WalletPurchaseRestriction,
    /**
     * 通貨購入の一時停止設定
     * enabled: true かつスケジュール期間内の場合、全通貨の購入を停止する
     * start/end が null の場合は制限なし（enabled: true + 両方 null = 無期限停止）
     */
    purchaseSuspension: {
      enabled: false,
      schedule: {
        start: null as string | null, // 開始時刻（ISO8601形式）例: '2025-06-01T00:00:00+09:00'
        end: null as string | null,   // 終了時刻（ISO8601形式）例: '2025-06-02T00:00:00+09:00'
      },
      /** 停止中に表示するメッセージ（nullでデフォルトメッセージを使用） */
      message: null as string | null,
    },
    /** 管理者による残高変更時にユーザーへ通知を送信する（操作タイプ別） */
    notifyOnAdjust: {
      increment: false,
      decrement: false,
      set: false,
    },
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
      enabled: true,
    },
    referral: {
      /** 紹介機能を有効にする（招待コードの実体はクーポンなので coupon.enabled も true が必要） */
      enabled: true,
    },
    notification: {
      /** 管理者による全体配信を有効にする（false: 管理画面メニュー非表示・ページ404） */
      enableAdminBroadcast: false,
      /** ユーザー側に未読通知モーダルを表示する */
      showUnreadModal: false,
      /** 未読通知モーダルを表示するパス一覧（完全一致。末尾 * で前方一致） */
      unreadModalPaths: ["/"] as readonly string[],
    },
  },
  pages: {
    // upstream の画面を止めるスイッチ(false = その画面と対応する API を 404。src/proxies/featureGateRules/)。
    // fork は画面を消したり rename したりせず、ここで止める。fork が同じ URL の下に足したページは止まらない
    /** マイページ(/mypage 以下の upstream の画面すべて。invite・pause・withdraw・other は各機能のフラグでも止まる) */
    mypage: true,
    /** マイページ > アカウントの各画面 */
    mypageAccount: {
      /** アカウントのトップ(/mypage/account) */
      top: true,
      email: true,
      password: true,
      phone: true,
      profile: true,
    },
    /** 特設ページ(/entry) */
    entry: true,
    /** サービス紹介(/services) */
    services: true,
    /** 規約のページ */
    legal: {
      privacyPolicy: true,
      terms: true,
      tradelaw: true,
    },
  },
  demo: {
    /** デモページ（/demo配下と管理画面のタブのデモ /admin/tabs-demo）を有効にする */
    samplePages: true,
    /** デモログイン機能を有効にする */
    login: true,
  },
} as const;

export type ThirdPartyProvider = keyof typeof APP_FEATURES.auth.thirdPartyProviders;
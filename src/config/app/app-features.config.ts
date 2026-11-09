// src/config/app-features.config.ts

// アプリ全体で利用する機能トグルを定義します。
// ここで定義された値を参照することで、UI や機能を環境ごとに切り替えられるようにします。
// ルートのブロックとテーブル作成の抑止は src/featureGate/rules/ の規則で自動制御されます。

import type { EmailCheckMode } from "./types";

export const APP_FEATURES = {
  auth: {
    // サインアップの mode は src/features/core/user/config.ts の signupMode
    // 入切でない値(サードパーティの提供元・デモのセッション期限・本登録の画面と遷移・Hide My Email)は src/features/core/auth/config.ts(上書き src/config/features/auth.config.ts)
    session: {
      /** JWT セッション Cookie の名前 */
      cookieName: "__session",
      /** セッションの有効期限（秒）: 7日間 */
      defaultMaxAgeSeconds: 60 * 60 * 24 * 7,
    },
    signup: {
      /** サインアップ機能を有効にする（falseで完全ロック: 画面・API共にアクセス不可） */
      enabled: true,
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
    },
  },
  user: {
    // 電話番号認証・アバター・管理画面のユーザー管理とメモ・一覧の挙動は src/features/core/user/config.ts(上書き src/config/features/user.config.ts)
    /** 休会機能を有効にする */
    pauseEnabled: false,
    /** 退会機能を有効にする */
    withdrawEnabled: false,
    /** ユーザータグ機能を有効にする（false の場合はメニュー非表示・ページ 404・フォーム非表示） */
    enableUserTag: true,
  },
  adminConsole: {
    // ダークモード切替の可否は src/config/ui/site-theme.config.ts(areas.admin.switchable)へ移動
    // サイドバーの幅の変更は管理の枠 src/app/admin/_layout/config.ts、ダッシュボードは src/features/core/admin/config.ts
    /** デモユーザー機能を有効にする（false の場合はメニュー非表示・ページ 404） */
    enableDemoUser: true,
    /** チャットルームの管理画面(/admin/chat-rooms)を有効にする(利用者側のチャットは止めない) */
    enableChatRoomAdmin: true,
    /** 通知テンプレートの管理画面と API を有効にする */
    enableNotificationTemplates: false,
  },
  payment: {
    /**
     * 決済機能（購入・決済プロバイダ webhook・銀行振込・購入上限）を有効にする
     * false: 関連ルートは 404、関連テーブルは db:push で作られない（既存テーブルは消さない）
     * true にする場合は wallet.enabled も true が必要（購入リクエストがウォレット履歴を参照するため）
     * @see src/featureGate/rules/payment.ts
     */
    enabled: true,
  },
  wallet: {
    /**
     * ウォレット機能を有効にする
     * false: 関連ルートは 404、関連テーブルは db:push で作られない（既存テーブルは消さない）
     * @see src/featureGate/rules/wallet.ts
     */
    enabled: true,
    // 入切でない値(残高調整・購入制限・購入の一時停止・調整の通知)は src/features/core/wallet/config.ts(上書き src/config/features/wallet.config.ts)
  },
  dataMigration: {
    /** 最大レコード数制限（デフォルト: 1000） */
    maxRecordLimit: 1000,
  },
  marketing: {
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
    },
  },
  pages: {
    // upstream の画面を止めるスイッチ(false = その画面と対応する API を 404。src/featureGate/rules/)。
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
  },
  demo: {
    /** デモページ（/demo 配下）を有効にする */
    samplePages: true,
    /** デモログイン機能を有効にする */
    login: true,
  },
} as const;

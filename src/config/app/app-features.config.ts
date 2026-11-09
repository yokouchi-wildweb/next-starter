// src/config/app-features.config.ts

// アプリ全体の値のうち、まだ持ち主の設定へ移していない物(棚の lib の reCAPTCHA の閾値・データ移行の上限)。
// 機能の入切(人が開け閉めする値)はここに置かない: 上流の既定は門番の規則のファイル src/featureGate/rules/<名前>.ts の defaultEnabled、
// fork の値は src/config/featureGate/switches.config.ts(門番 D35・設定 D91・D92)。読み手は gate.enabled / useGate().enabled

export const APP_FEATURES = {
  auth: {
    // サインアップの mode は src/features/core/user/config.ts の signupMode。サインアップの入切は門番の規則 signup
    // 入切でない値(サードパーティの提供元・デモのセッション期限・本登録の画面と遷移・Hide My Email)は src/features/core/auth/config.ts(上書き src/config/features/auth.config.ts)
    signup: {
      /**
       * reCAPTCHA v3 スコア閾値（0.0〜1.0）
       * - スコア >= recaptchaThreshold → 通過
       * - スコア >= recaptchaV2Threshold かつ < recaptchaThreshold → v2チャレンジ
       * - スコア < recaptchaV2Threshold → ブロック
       */
      recaptchaThreshold: 0.7,
      /** reCAPTCHA v2チャレンジ閾値（これ未満は即ブロック） */
      recaptchaV2Threshold: 0.3,
    },
  },
  dataMigration: {
    /** 最大レコード数制限（デフォルト: 1000） */
    maxRecordLimit: 1000,
  },
} as const;

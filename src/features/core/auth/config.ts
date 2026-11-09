// src/features/core/auth/config.ts
// 認証の設定(既定 + 上書き)。上書きは src/config/features/auth.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。fork 独自の鍵は上書きで `export type Extra = { <鍵>: <型> }` を宣言して値を書く(authConfig.<鍵> で読める)
// サインアップの入切と mode・セッション Cookie・reCAPTCHA・メールチェックはまだ src/config/app/app-features.config.ts(門番の議会・棚の議会のクエストが移す)

import override, { type Extra } from "@/config/features/auth.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/**
 * Hide My Email（Apple「メールを非公開」）検知時のアクション
 * - disabled: チェックなし
 * - block: 検知時にサイレントブロック（メール送信しない）
 * - challenge: 検知時にreCAPTCHA v2チャレンジを要求
 */
export type HideMyEmailAction = "disabled" | "block" | "challenge";

export type AuthConfig = {
  /** サードパーティ認証の提供元ごとの有効化 */
  thirdPartyProviders: {
    google: boolean;
    yahoo: boolean;
    facebook: boolean;
    twitter: boolean;
  };
  session: {
    /** デモユーザー用セッションの有効期限（秒） */
    demoMaxAgeSeconds: number;
  };
  signup: {
    /** 認証完了後の遷移先パス */
    afterVerificationPath: string;
    /** 本登録ページに進捗インディケーターを表示する */
    showRegistrationSteps: boolean;
    /** パスワード入力モード: "single"=確認なし, "double"=確認あり */
    passwordInputMode: "single" | "double";
    /** 本登録画面でロール選択を表示するか */
    showRoleSelection: boolean;
    /**
     * 本登録画面で選択可能なロール
     * user カテゴリかつ enabled: true のロールのみ指定可能
     * @see src/features/core/user/roles/
     */
    allowedRoles: readonly string[];
    /** ロール選択非表示時のデフォルトロール（allowedRoles に含まれている必要あり） */
    defaultRole: string;
    /** メール認証完了後の動作: "manual"=ボタン表示, "auto"=自動遷移 */
    emailVerificationRedirect: "manual" | "auto";
    /** Hide My Email 検知時のアクション */
    hideMyEmailAction: HideMyEmailAction;
  };
  /** 重複登録の警告モーダルの文言(本文は行ごと) */
  rateLimitWarning: {
    title: string;
    bodyLines: readonly string[];
  };
};

const defaults: AuthConfig = {
  thirdPartyProviders: {
    google: false,
    yahoo: false,
    facebook: false,
    twitter: false,
  },
  session: {
    demoMaxAgeSeconds: 60 * 10,
  },
  signup: {
    afterVerificationPath: "/signup/register",
    showRegistrationSteps: true,
    passwordInputMode: "single",
    showRoleSelection: false,
    allowedRoles: ["user"],
    defaultRole: "user",
    emailVerificationRedirect: "auto",
    hideMyEmailAction: "challenge",
  },
  rateLimitWarning: {
    title: "重複したユーザー登録が確認されました。",
    bodyLines: ["同一人物による複数アカウントの作成は", "重大な利用規約違反となります。"],
  },
};

export const authConfigDef = defineConfig(defaults, { label: "auth" });

/** 上書きのファイルの型(`export default { ... } satisfies AuthOverride`)。fork 独自の鍵は上書きの `export type Extra` */
export type AuthOverride<E extends object = Record<never, never>> = OverrideOf<typeof authConfigDef, E>;

/** サードパーティ認証の提供元の名前 */
export type ThirdPartyProvider = keyof AuthConfig["thirdPartyProviders"];

/** 合成済みの設定(上流の値 + 上書き、fork が Extra で足した鍵も入る) */
export const authConfig: AuthConfig & Extra = authConfigDef.compose<Extra>(override);

// src/lib/recaptcha/config.ts
//
// reCAPTCHA の設定(既定 + 上書き)。上書きは src/config/lib/recaptcha.config.ts(@lib-config/recaptcha)の 1 ファイル。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// - サイトキー(公開): 上書きに env の NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY / NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY をその字面で書く(client ではビルド時に埋め込まれる)
// - シークレット(サーバーだけ): 呼んだ時に読む関数で受け、./server の中でだけ呼ぶ(読み込み時には読まない)
// lib の中では env を読まない。空・短すぎるキー = 未設定(その版の reCAPTCHA は無効)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/recaptcha";

/** 1 つの版(v3 / v2)のキー */
export type RecaptchaKeys = {
  /** サイトキー(公開。client と server が読む)。空 = 未設定 */
  siteKey: string;
  /** シークレットキーを返す(サーバーだけ。./server の中でだけ呼ぶ)。空・undefined = 未設定 */
  secretKey: () => string | undefined;
};

export type RecaptchaConfig = {
  /** v3: スコアによる自動の判定(主) */
  v3: RecaptchaKeys;
  /** v2: チャレンジによる手動の認証(v3 が中間のスコアのときの代わり) */
  v2: RecaptchaKeys;
};

const defaults: RecaptchaConfig = {
  v3: { siteKey: "", secretKey: () => undefined },
  v2: { siteKey: "", secretKey: () => undefined },
};

export const recaptchaConfigDef = defineConfig(defaults, { label: "recaptcha" });

/** 上書きのファイルの型(`export default { ... } satisfies RecaptchaOverride`) */
export type RecaptchaOverride<E extends object = Record<never, never>> = OverrideOf<typeof recaptchaConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る。シークレットの関数はここでは呼ばない) */
export const recaptchaConfig: RecaptchaConfig = recaptchaConfigDef.compose(override);

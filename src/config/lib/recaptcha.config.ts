// src/config/lib/recaptcha.config.ts
// reCAPTCHA の設定の上書き(@lib-config/recaptcha)。キーと既定: src/lib/recaptcha/config.ts
// - サイトキーは process.env.NEXT_PUBLIC_RECAPTCHA_* をこの形のまま書く(client ではビルド時に埋め込まれる。変数を介すと埋め込まれない)
// - シークレットは関数のまま(呼んだ時に読む。lib の ./server だけが呼ぶ)
import type { RecaptchaOverride } from "@/lib/recaptcha";

export default {
  v3: {
    siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
    secretKey: () => process.env.RECAPTCHA_V3_SECRET_KEY,
  },
  v2: {
    siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY,
    secretKey: () => process.env.RECAPTCHA_V2_SECRET_KEY,
  },
} satisfies RecaptchaOverride;

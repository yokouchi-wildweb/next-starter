// src/lib/spamGuard/config.ts
//
// 使い捨てメールの判定(spamGuard)の設定(既定 + 上書き)。上書きは src/config/lib/spamGuard.config.ts(@lib-config/spamGuard)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 許可リスト(whitelist.ts)・DeBounce API の宛先と時間(debounce.ts)は判定の仕組みと組なので各ファイルの定数のまま。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/spamGuard";

/**
 * メールチェックモード
 * - disabled: チェックなし
 * - full: 4段階フルチェック（信頼ドメイン→TLD→OSS→DeBounce）
 * - strict: 信頼ドメイン（TRUSTED_DOMAINS）のみ許可
 */
export type EmailCheckMode = "disabled" | "full" | "strict";

export type SpamGuardConfig = {
  /** isDisposableEmail のチェックモード(ローカルパートの文字チェックはモードに関係なく常に行う) */
  emailCheckMode: EmailCheckMode;
};

const defaults: SpamGuardConfig = {
  emailCheckMode: "disabled",
};

export const spamGuardConfigDef = defineConfig(defaults, { label: "spamGuard" });

/** 上書きのファイルの型(`export default { ... } satisfies SpamGuardOverride`) */
export type SpamGuardOverride<E extends object = Record<never, never>> = OverrideOf<typeof spamGuardConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const spamGuardConfig: SpamGuardConfig = spamGuardConfigDef.compose(override);

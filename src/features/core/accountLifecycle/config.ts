// src/features/core/accountLifecycle/config.ts
// 休会・退会・復帰の設定(既定 + 上書き)。上書きは src/config/features/accountLifecycle.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig
// 機能の入切(pause / withdraw / mypage* の規則)はここに置かない(門番の規則 src/featureGate/rules/ が持つ)

import override from "@/config/features/accountLifecycle.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type AccountLifecycleConfig = {
  withdraw: {
    /**
     * 退会の画面(/mypage/withdraw)の説明文。WithdrawDescription が 1 つの段落(Para tone muted size sm)で出す。
     * `\n` はそのまま改行として出る(whitespace-pre-line)。既定は今までの表示どおり 2 文を空白でつなぐ
     */
    description: string;
  };
};

const defaults: AccountLifecycleConfig = {
  withdraw: {
    description:
      "退会すると、アカウントに関連するデータにアクセスできなくなります。 退会後に再度サービスを利用する場合は、新規登録が必要です。",
  },
};

export const accountLifecycleConfigDef = defineConfig(defaults, { label: "accountLifecycle" });

/** 上書きのファイルの型(`export default { ... } satisfies AccountLifecycleOverride`) */
export type AccountLifecycleOverride<E extends object = Record<never, never>> = OverrideOf<
  typeof accountLifecycleConfigDef,
  E
>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const accountLifecycleConfig: AccountLifecycleConfig = accountLifecycleConfigDef.compose(override);

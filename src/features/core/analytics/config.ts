// src/features/core/analytics/config.ts
// 分析の設定(既定 + 上書き、設定の議会 D11・D19・D74・D95)。上書きは src/config/features/analytics.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。呼び手は analyticsConfig.<鍵> を読む
// 今はコイン創出サマリー(管理画面のコイン収支)の値だけ。配列の上書きは丸ごと置き換え(defineConfig の既定)

import override from "@/config/features/analytics.config";
import type { WalletType } from "@/features/wallet/config";
import type { ReasonCategory } from "@/features/walletHistory/config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type AnalyticsConfig = {
  /**
   * 発行 wallet_bonus_grant(台帳の純額)に数える通貨。仕組みはどの通貨にも使え、このまとめに数える通貨だけをここで選ぶ。
   * 数える区分は issuanceReasonCategories
   */
  coinIssuanceWalletTypes: readonly WalletType[];
  /**
   * コイン創出ソースの表示名(key → 表示名)。未定義の key は key そのものを表示する。
   * fork のソースの表示名もここに足す(上流の表示名の差し替えも値の書き換えで)
   */
  coinIssuanceLabels: Readonly<Record<string, string>>;
  /**
   * 発行 wallet_bonus_grant に数える reason_category(ウォレット履歴の区分。D74: 何を創出と数えるかは分析の判断)。
   * 区分なしで書かれた付与も拾いたい fork は "other" を足す
   */
  issuanceReasonCategories: readonly ReasonCategory[];
};

const defaults: AnalyticsConfig = {
  coinIssuanceWalletTypes: ["regular_coin"],
  coinIssuanceLabels: {
    // コイン購入時にサービス側が負担した分のうち、purchase_requests の amount に含まれるもの
    // (クーポン割引 / 購入パッケージの上乗せ等。別のウォレット行で払うボーナスは wallet_bonus_grant 側)
    purchase_bonus_gap: "購入時ボーナス発行",
    // 購入以外で仕組みとして配ったコイン(wallet_histories の数える区分の純額。紹介報酬・クーポン帰属報酬も含む)
    wallet_bonus_grant: "販促・特典付与",
    // 以下は上流の登録から外したソースの key(fork が内訳のソースを自分で足すときの表示名)
    referral_reward: "紹介リワード",
    coupon_attribution_reward: "クーポン帰属報酬",
  },
  issuanceReasonCategories: ["bonus"],
};

export const analyticsConfigDef = defineConfig<AnalyticsConfig>(defaults, { label: "analytics" });

/** 上書きのファイルの型(`export default { ... } satisfies AnalyticsOverride`) */
export type AnalyticsOverride<E extends object = Record<never, never>> = OverrideOf<typeof analyticsConfigDef, E>;

/** 合成済みの設定 */
export const analyticsConfig = analyticsConfigDef.compose(override);

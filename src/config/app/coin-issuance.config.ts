// src/config/app/coin-issuance.config.ts
// コイン創出ソースの表示名(key → 表示名)。未定義の key は key そのものを表示する。
// fork のソースの表示名もここに足す(上流の表示名の差し替えも値の書き換えで)。

import type { WalletType } from "@/config/app/currency.config";

/**
 * 発行 wallet_bonus_grant(台帳の純額)に数える通貨。仕組みはどの通貨にも使え、このまとめに数える通貨だけをここで選ぶ。
 * 数える区分は src/config/app/wallet-reason-category.config.ts の countsAsIssuance
 */
export const COIN_ISSUANCE_WALLET_TYPES: readonly WalletType[] = ["regular_coin"];

export const COIN_ISSUANCE_LABELS: Readonly<Record<string, string>> = {
  // コイン購入時にサービス側が負担した分のうち、purchase_requests の amount に含まれるもの
  // (クーポン割引 / 購入パッケージの上乗せ等。別のウォレット行で払うボーナスは wallet_bonus_grant 側)
  purchase_bonus_gap: "購入時ボーナス発行",
  // 購入以外で仕組みとして配ったコイン(wallet_histories の countsAsIssuance の区分の純額。紹介報酬・クーポン帰属報酬も含む)
  wallet_bonus_grant: "販促・特典付与",
  // 以下は上流の登録から外したソースの key(fork が内訳のソースを自分で足すときの表示名)
  referral_reward: "紹介リワード",
  coupon_attribution_reward: "クーポン帰属報酬",
};

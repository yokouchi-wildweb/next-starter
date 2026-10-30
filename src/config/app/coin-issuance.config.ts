// src/config/app/coin-issuance.config.ts
// コイン創出ソースの表示名(key → 表示名)。未定義の key は key そのものを表示する。
// fork のソースの表示名もここに足す(上流の表示名の差し替えも値の書き換えで)。

export const COIN_ISSUANCE_LABELS: Readonly<Record<string, string>> = {
  // コイン購入時にサービス側が負担した上乗せボーナス全般
  // (クーポン割引 / ユーザーランクボーナス / 決済方法ボーナス / 購入パッケージの上乗せ等)
  purchase_bonus_gap: "購入時ボーナス発行",
  referral_reward: "紹介リワード",
  coupon_attribution_reward: "クーポン帰属報酬",
};

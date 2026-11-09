// src/config/features/walletHistory.config.ts
// ウォレット履歴の区分の設定の上書き(持ち主 src/features/core/walletHistory/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 区分を足す: 下の Extra に `reasonCategory: { <区分>: ReasonCategoryConfig }` を足し、値を書く(ReasonCategory に入る)
// 例: `export default { reasonCategory: { gacha_play: { label: "ガチャ", sourceTypes: ["user_action"], sortOrder: 20 } } } satisfies WalletHistoryOverride<Extra>;`
import type { WalletHistoryOverride } from "@/features/walletHistory/config";

export type Extra = Record<never, never>;

export default {} satisfies WalletHistoryOverride<Extra>;

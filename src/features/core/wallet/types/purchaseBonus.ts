// src/features/core/wallet/types/purchaseBonus.ts
// 購入の特典の表示(受け口 purchaseBonuses: purchaseBonuses/<key>.ts の export const provider)の型。
// 表示だけ: 特典の付与はサーバーの purchaseRequest の completeHooks が行う。書き方: src/features/core/wallet/README.md「購入の特典の表示」

import type { WalletType } from "@/features/wallet/config";

/** 表示する特典 1 つ */
export type PurchaseBonus = {
  /** 識別(React の key・重なりの見分け。省略 = 提供元の key と並び) */
  key?: string;
  /** 見せる文言(バッジ・まとめの行の見出し。例 "ランク特典 +5%") */
  label: string;
  /** 追加で付く通貨の量(まとめの行と購入後の残高に足す。省略 = 文言だけ) */
  amount?: number;
};

/** パッケージ一覧の 1 行(PurchaseList) */
export type PurchaseBonusPackageContext = { walletType: WalletType; amount: number };

/** 支払い方法の 1 枚(SupportedPaymentMethods)。method = purchaseRequest の paymentMethods[].id */
export type PurchaseBonusPaymentMethodContext = { walletType: WalletType; method: string };

/** 購入のまとめ(PurchaseSummaryCard)。paymentMethod = 選んだ支払い方法(未選択 = null) */
export type PurchaseBonusPurchaseContext = { walletType: WalletType; purchaseAmount: number; paymentMethod: string | null };

/** 提供元が返す値の読み方(どれも省略可。null = その場所には出さない) */
export type PurchaseBonusSource = {
  forPackage?: (ctx: PurchaseBonusPackageContext) => PurchaseBonus | null;
  forPaymentMethod?: (ctx: PurchaseBonusPaymentMethodContext) => PurchaseBonus | null;
  forPurchase?: (ctx: PurchaseBonusPurchaseContext) => PurchaseBonus | null;
};

/** 1 提供元の定義(purchaseBonuses/<key>.ts の export const provider) */
export type PurchaseBonusProvider = {
  /** 一意の名前 = ファイル名(英字始まりの英数字、camelCase)。override の対象もこの名前 */
  key: string;
  /** 並び(昇順、同じ値は key 順)。同じ場所に複数の特典が出るときの順 */
  order: number;
  /** false = 使わない(省略 = 使う)。読み込み時に決まる値に限る */
  enabled?: boolean;
  /** 値の読み方を返す hook(SWR などを呼んでよい)。毎描画で 1 回、生成の一覧の順に呼ばれる */
  useSource: () => PurchaseBonusSource;
};

/** 上の Tier の提供元の隣の <key>.override.ts で変えられる属性(受け口の overrideOf と同じ) */
export type PurchaseBonusProviderOverride = Partial<Pick<PurchaseBonusProvider, "enabled" | "order">>;

/** usePurchaseBonuses の戻り値(全提供元の特典を並びの順にまとめたもの) */
export type PurchaseBonuses = {
  forPackage: (ctx: PurchaseBonusPackageContext) => PurchaseBonus[];
  forPaymentMethod: (ctx: PurchaseBonusPaymentMethodContext) => PurchaseBonus[];
  forPurchase: (ctx: PurchaseBonusPurchaseContext) => PurchaseBonus[];
  /** forPurchase の amount の合計(購入後の残高に足す量) */
  totalForPurchase: (ctx: PurchaseBonusPurchaseContext) => number;
};

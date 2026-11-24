// src/lib/backends/prices.ts
// 単価の表(D37): 口の実装の課金の目盛り(declaration の billing の priceKey)が指す行。上流だけが書く値で、fork は読むだけ
// (fork が自分の値を持つ形は要る時に対置型で足す)。今は行が無い

/** 単価の表の 1 行(鍵 = priceKey、表の中で一意) */
export type BackendPriceRow = {
  /** 課金の目盛りの priceKey が指す鍵 */
  priceKey: string;
  /** 1 単位(message・request・gbMonth・sms・mau・month 等) */
  unit: string;
  /** 通貨(ISO 4217、例 "USD") */
  currency: string;
  /** 1 単位あたりの金額 */
  amount: number;
  /** 値の出どころ(提供元の料金のページの URL など) */
  source: string;
  /** 値を確かめた日(YYYY-MM-DD) */
  checkedAt: string;
};

/** 単価の表(上流だけが書く。行が増えたら priceKey の一意を保つ) */
export const backendPrices: readonly BackendPriceRow[] = [];

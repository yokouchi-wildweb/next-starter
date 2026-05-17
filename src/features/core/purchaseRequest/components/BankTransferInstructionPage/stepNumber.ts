// src/features/core/purchaseRequest/components/BankTransferInstructionPage/stepNumber.ts
//
// ステップ番号 (1, 2, 3, ...) を全角丸数字 (①, ②, ③, ...) に変換するユーティリティ。
//
// 親コンポーネント側で feature flag に応じて動的にステップ番号を割り当て、
// 各セクションコンポーネントが step prop で受け取って表示する設計のため、
// ハードコードされた ①②③ を排して保守性を高める目的で導入している。

/** ステップ番号 → 全角丸数字 (①〜⑳)。範囲外なら半角数字へフォールバック。 */
export function circledNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 20) return String(n);
  // U+2460 (①) から U+2473 (⑳) まで連続
  return String.fromCharCode(0x2460 + (n - 1));
}

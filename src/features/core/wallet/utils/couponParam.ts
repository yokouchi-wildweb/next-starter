// アクティブクーポンコードのsessionStorage管理
//
// 「現在適用中のクーポンコード」を1つだけ保持する。
// どのページからでも保存・参照・クリアできる。
//
// 保存タイミング:
//   - URLパラメータ ?coupon=CODE でアクセスした時
//   - CouponInput でクーポンを適用した時
// クリアタイミング:
//   - CouponInput でクーポンを取り消した時
//   - 購入完了時（将来）
// 参照タイミング:
//   - CouponInput マウント時に自動適用

const STORAGE_KEY = "wallet_active_coupon";

/**
 * アクティブクーポンコードを保存
 */
export function setActiveCoupon(code: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, code);
  } catch {
    // sessionStorage使用不可（SSR、プライベートブラウジング等）は無視
  }
}

/**
 * アクティブクーポンコードを取得（削除しない）
 */
export function getActiveCoupon(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * アクティブクーポンコードをクリア
 */
export function clearActiveCoupon(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}

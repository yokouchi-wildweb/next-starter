// URLパラメータ経由のクーポンコード保持
//
// /wallet/coin?coupon=CODE のようなURLでアクセスした際に
// クーポンコードをsessionStorageに保存し、購入ページで自動入力する。

const STORAGE_KEY = "wallet_coupon_code";

/**
 * sessionStorageにクーポンコードを保存
 */
export function saveCouponCode(code: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, code);
  } catch {
    // sessionStorage使用不可（SSR、プライベートブラウジング等）は無視
  }
}

/**
 * sessionStorageからクーポンコードを取得（取得後に削除）
 */
export function consumeCouponCode(): string | null {
  try {
    const code = sessionStorage.getItem(STORAGE_KEY);
    if (code) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return code;
  } catch {
    return null;
  }
}

/**
 * sessionStorageのクーポンコードを削除
 */
export function clearCouponCode(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}

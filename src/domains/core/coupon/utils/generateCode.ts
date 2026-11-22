/**
 * クーポンコード生成ユーティリティ
 *
 * 紛らわしい文字を除外した英数字でランダムコードを生成する
 * 除外文字: 0, O, I, 1, L（読み間違い防止）
 */

// 使用可能文字: A-Z（O, I, Lを除く）+ 2-9（0, 1を除く）
const AVAILABLE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const DEFAULT_LENGTH = 8;

/**
 * ランダムなクーポンコードを生成する
 * @param length コードの長さ（デフォルト: 8）
 * @returns 生成されたクーポンコード
 */
export function generateCouponCode(length: number = DEFAULT_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * AVAILABLE_CHARS.length);
    code += AVAILABLE_CHARS[randomIndex];
  }
  return code;
}

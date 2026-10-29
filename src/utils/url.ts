// src/utils/url.ts

/**
 * 利用者が入力した URL を href に渡してよいか(http: / https: だけ true)。
 * javascript: / data: / vbscript: 等のスキームや、URL として解析できない値は false。
 */
export function isSafeHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

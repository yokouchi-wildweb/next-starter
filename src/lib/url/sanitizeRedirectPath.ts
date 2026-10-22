// src/lib/url/sanitizeRedirectPath.ts

const CHECK_ORIGIN = "http://sanitize-redirect.invalid";

// 制御文字（C0 / DEL）。改行によるヘッダ注入やブラウザの寛容な解釈の足場になるため拒否する
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * リダイレクト先として受け取った値を、同一オリジンの相対パスに限定して返す（オープンリダイレクト対策）。
 *
 * 許可: "/" 始まりの相対パス（クエリ・ハッシュ可）。例: "/mypage?tab=x#top"
 * 拒否 → fallback:
 * - 空・非文字列
 * - "//evil.example" / "/\evil.example"（ブラウザはプロトコル相対 URL として外部へ飛ぶ）
 * - "https://evil.example" / "javascript:..." などスキーム付き・"/" で始まらない値
 * - 制御文字を含む値（"%0d%0a" のようにエンコードされたものはパス文字として扱われるので許可）
 * - URL として解釈した結果オリジンが変わる値（文字列判定の取りこぼし対策）
 *
 * 戻り値は URL として正規化した pathname + search + hash。
 * クライアント・サーバーどちらからも使える（依存なし）。
 */
export function sanitizeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (CONTROL_CHARS.test(value)) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(value, CHECK_ORIGIN);
  } catch {
    return fallback;
  }
  if (parsed.origin !== CHECK_ORIGIN) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

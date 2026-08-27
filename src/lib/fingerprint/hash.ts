// src/lib/fingerprint/hash.ts
//
// フィンガープリント成分のハッシュ化ユーティリティ（クライアント / サーバー両用）。
// Web Crypto (SHA-256) を優先し、非 secure context 等で crypto.subtle が
// 使えない環境では FNV-1a 64bit にフォールバックする（識別用途であり
// 暗号強度は不要。フォールバック時はプレフィックスで区別可能にする）。

/** 安定ストリンガイズ（オブジェクトキーを再帰的にソート）。ハッシュの入力を正規化する */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * FNV-1a 32bit（BigInt 非依存 = ES2017 ターゲット互換）。crypto.subtle 不可時の
 * フォールバック。非 secure context 等でしか通らない縮退経路であり、識別用途に
 * 32bit の衝突耐性で十分（暗号強度は不要）。8 桁 hex で返す。
 */
export function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime 16777619 の乗算を Math.imul で 32bit に丸める
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * 文字列を SHA-256 hex にハッシュする。crypto.subtle が使えない環境では
 * "fnv:" プレフィックス付きの FNV-1a 32bit を返す。
 */
export async function hashString(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `fnv:${fnv1a32Hex(input)}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 任意の値を安定ストリンガイズしてハッシュする */
export async function hashValue(value: unknown): Promise<string> {
  return hashString(stableStringify(value));
}

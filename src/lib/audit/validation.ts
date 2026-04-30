// src/lib/audit/validation.ts

/**
 * jsonb 1 カラムあたりの上限バイト数（参考: 行サイズ・index への影響を避けるため控えめに設定）。
 * 超過時は値を切り詰め、`{ _truncated: true, _originalSize: <bytes> }` で置換する。
 */
const MAX_VALUE_BYTES = 16 * 1024;

const TRUNCATION_MARKER_KEY = "__audit_truncated__";

type TruncatedMarker = {
  [TRUNCATION_MARKER_KEY]: true;
  originalBytes: number;
  preview: string;
};

/**
 * 値の概算バイト数（UTF-8 想定）。JSON.stringify 後の長さを使う。
 * Date / undefined 等で stringify が失敗するケースは考慮しない（呼び出し側で正規化済み）。
 */
function approximateByteSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

/**
 * jsonb 値が大きすぎる場合に切り詰める。
 * - フラットな string: 先頭 256 文字を残してマーカー化
 * - object: 先頭から fitting する key だけ残し、それ以外をマーカー化
 *
 * オブジェクトなら個別 key を生かしたいので shallow に切り詰める。
 * 深いネストは preview 側に文字列化して載せる。
 */
export function truncateLargeValues(input: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!input) return input;
  const totalSize = approximateByteSize(input);
  if (totalSize <= MAX_VALUE_BYTES) return input;

  const result: Record<string, unknown> = {};
  let used = 0;
  for (const [key, value] of Object.entries(input)) {
    const size = approximateByteSize(value);
    if (used + size <= MAX_VALUE_BYTES) {
      result[key] = value;
      used += size;
      continue;
    }
    const marker: TruncatedMarker = {
      [TRUNCATION_MARKER_KEY]: true,
      originalBytes: size,
      preview: stringPreview(value),
    };
    result[key] = marker;
    used += approximateByteSize(marker);
    if (used >= MAX_VALUE_BYTES) break;
  }
  return result;
}

function stringPreview(value: unknown): string {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    return s.length > 256 ? `${s.slice(0, 256)}...` : s;
  } catch {
    return "[unserializable]";
  }
}

/**
 * action 名の最低限の検証。空 / 改行 / 制御文字混入を弾く。
 * 詳細な namespace 規約は ESLint rule で別途強制（Phase 6）。
 */
const ACTION_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export function validateActionName(action: string): void {
  if (!action || typeof action !== "string") {
    throw new Error("audit: action must be a non-empty string");
  }
  if (!ACTION_NAME_PATTERN.test(action)) {
    throw new Error(
      `audit: action name "${action}" does not match "<domain>.<entity>.<verb>" convention (lowercase, dot-separated)`,
    );
  }
}

/**
 * targetId は text 型で許容するが、空文字 / 過剰長を弾く。
 */
export function validateTargetId(targetId: string): void {
  if (!targetId || typeof targetId !== "string") {
    throw new Error("audit: targetId must be a non-empty string");
  }
  if (targetId.length > 256) {
    throw new Error("audit: targetId exceeds 256 characters");
  }
}

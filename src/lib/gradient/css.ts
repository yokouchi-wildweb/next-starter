// src/lib/gradient/css.ts
// グラデーションCSS文字列の解析ヘルパー（純粋TS・依存なし）。
// oklch / hsl / hex / rgb いずれの色表記にも対応する。

/** linear/radial/conic（repeating 含む）グラデーションかどうかを判定する。 */
export function isGradient(css: string | null | undefined): boolean {
  if (!css) return false;
  return /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(css);
}

/**
 * トップレベル（括弧の外）のカンマで分割する。
 * oklch(0.6 0.15 220) のような括弧内カンマ無し表記も、rgb(1, 2, 3) の括弧内カンマも壊さない。
 */
function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** グラデーションの最初の引数が方向/角度指定かどうか（色ストップでない）。 */
function isDirectionSegment(segment: string): boolean {
  return /^to\s/i.test(segment) || /(deg|grad|rad|turn)$/i.test(segment);
}

/** 色ストップから末尾の位置指定（"red 10%" の "10%" 等）を除いた色部分を取り出す。 */
function stripStopPosition(segment: string): string {
  let depth = 0;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === " " && depth === 0) {
      return segment.slice(0, i).trim();
    }
  }
  return segment.trim();
}

/** 最初のグラデーション関数の括弧内（引数部分）を取り出す。見つからなければ null。 */
function extractGradientArgs(css: string): string | null {
  const match = /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.exec(css);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")") {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  return null;
}

/**
 * グラデーションCSSから両端（最初と最後）の色を抽出する。
 * グラデーションでない場合や色が取れない場合は null。
 *
 * @example
 *   extractEdgeColors("linear-gradient(135deg, oklch(0.6 0.15 220), oklch(0.5 0.18 200))")
 *   // => { left: "oklch(0.6 0.15 220)", right: "oklch(0.5 0.18 200)" }
 */
export function extractEdgeColors(
  css: string | null | undefined,
): { left: string; right: string } | null {
  if (!isGradient(css)) return null;
  const args = extractGradientArgs(css as string);
  if (!args) return null;

  let segments = splitTopLevelCommas(args);
  // 先頭が方向/角度なら除去
  if (segments.length > 0 && isDirectionSegment(segments[0])) {
    segments = segments.slice(1);
  }
  if (segments.length === 0) return null;

  const left = stripStopPosition(segments[0]);
  const right = stripStopPosition(segments[segments.length - 1]);
  if (!left || !right) return null;

  return { left, right };
}

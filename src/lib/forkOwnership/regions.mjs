// fork の区画(fork entries の印の対)の読み取り。Node 組み込みだけで動く純粋な .mjs
// 仕様: ./README.md「registry の下流の印」

export const FORK_REGION_START = "// --- fork entries start (upstream never edits inside) ---";
export const FORK_REGION_END = "// --- fork entries end ---";

// 移行の間だけ読む古い下流の印(終わりの印が無く、字下げの浅い閉じ括弧の直前までが区画)
export const LEGACY_FORK_MARKERS = [
  /^\s*\/\/ --- DOWNSTREAM \(downstream で追加\) ---\s*$/,
  /^\s*\/\/ --- ここに.*（上流は空。下流が追記） ---\s*$/,
  /^\s*\/\/ --- FORK \(手書き\) ---\s*$/,
];

const indentOf = (line) => line.length - line.trimStart().length;

const isLegacyMarker = (line) => LEGACY_FORK_MARKERS.some((re) => re.test(line));

/**
 * テキストから fork の区画を読む。行番号は 1 始まり、start / end は印の行。
 * 古い印の区画は end = 閉じ括弧の行(legacy: true)。
 * @returns {{ regions: { start: number, end: number, legacy: boolean }[], errors: { line: number, message: string }[] }}
 */
export function parseForkRegions(text) {
  const lines = text.split("\n");
  const regions = [];
  const errors = [];
  let open = null;

  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();

    if (trimmed === FORK_REGION_START) {
      if (open !== null) {
        errors.push({ line, message: `区画の中に開始の印がある(入れ子は不可。${open} 行目の開始が閉じていない)` });
        return;
      }
      open = line;
      return;
    }
    if (trimmed === FORK_REGION_END) {
      if (open === null) {
        errors.push({ line, message: "開始の印の無い終了の印" });
        return;
      }
      regions.push({ start: open, end: line, legacy: false });
      open = null;
      return;
    }
    if (trimmed.startsWith("// ---") && /fork entries/.test(trimmed)) {
      errors.push({ line, message: `印の文言が違う(開始 \`${FORK_REGION_START}\` / 終了 \`${FORK_REGION_END}\`)` });
      return;
    }
    if (isLegacyMarker(raw)) {
      const indent = indentOf(raw);
      let end = index + 1;
      while (end < lines.length && !(indentOf(lines[end]) < indent && /^[\]}]/.test(lines[end].trimStart()))) {
        end += 1;
      }
      if (end >= lines.length) {
        errors.push({ line, message: "古い印の区画を閉じる括弧が見つからない" });
        return;
      }
      regions.push({ start: line, end: end + 1, legacy: true });
    }
  });

  if (open !== null) {
    errors.push({ line: open, message: "終了の印の無い開始の印" });
  }
  return { regions, errors };
}

/**
 * 行番号(1 始まり)が fork の区画の中(印の行を除く)にあるか。
 */
export function isInForkRegion(regions, line) {
  return regions.some((region) => line > region.start && line < region.end);
}

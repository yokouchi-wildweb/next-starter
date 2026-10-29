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

// 生成器の区画(所有の検査の対象外、D22)。印の統一は後継の論点なので今の書き方をそのまま読む
const GENERATOR_PAIRS = [
  { start: /^\s*\/\/ --- AUTO-GENERATED-START ---\s*$/, end: /^\s*\/\/ --- AUTO-GENERATED-END ---\s*$/ },
  { start: /^\s*\/\/ === AUTO-GENERATED (\S+) START ===\s*$/, end: /^\s*\/\/ === AUTO-GENERATED (\S+) END ===\s*$/ },
  // 道具が丸ごと書き足す区画(upstream に無いことがある)。印の行と直前の空行も区画に含める
  // - next dev が AGENTS.md に書く Next の注意書き(Next の版で中身が変わるので upstream に固定で置けない)
  { start: /^<!-- BEGIN:nextjs-agent-rules -->\s*$/, end: /^<!-- END:nextjs-agent-rules -->\s*$/, whole: true },
];
// 終わりの印の無い生成器の区画: 次の import 以外の行(空行を除く)の直前まで
const GENERATOR_OPEN_IMPORTS = /^\s*\/\/ --- Auto-generated imports ---\s*$/;

/**
 * テキストから生成器の区画を読む。行番号は 1 始まり、start / end は印の行。中身 = start と end の間の行。
 * 終わりの印の無い区画の end は、最後の import 行の次の行(その行は区画の外)。
 * whole の対は印の行と直前の空行も中身に含める(start / end をその外側の行にする。start は 0 になり得る)。
 * 閉じていない対は区画にしない(生成器自身が印の欠けを検出する)。
 * @returns {{ start: number, end: number }[]}
 */
export function parseGeneratorRegions(text) {
  const lines = text.split("\n");
  const regions = [];
  let open = null;

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (open === null) {
      const pair = GENERATOR_PAIRS.find((candidate) => candidate.start.test(raw));
      if (pair) {
        open = { start: line, pair };
        return;
      }
      if (GENERATOR_OPEN_IMPORTS.test(raw)) {
        let last = index;
        for (let next = index + 1; next < lines.length; next += 1) {
          const trimmed = lines[next].trim();
          if (trimmed === "") continue;
          if (!trimmed.startsWith("import ")) break;
          last = next;
        }
        regions.push({ start: line, end: last + 2 });
      }
      return;
    }
    if (open.pair.end.test(raw)) {
      if (open.pair.whole) {
        let start = open.start - 1;
        while (start >= 1 && lines[start - 1].trim() === "") start -= 1;
        regions.push({ start, end: line + 1 });
      } else {
        regions.push({ start: open.start, end: line });
      }
      open = null;
    }
  });
  return regions;
}

/**
 * 区画の中身(印の行は残す)を除いたテキスト。基準側と fork 側でこれが同じなら、書き換えは区画の中だけ。
 * 一時許可の指紋の元にもなる(D22: fork の区画と生成器の区画を除いて取る)。
 * @param {{ fork?: boolean }} [options] fork: false = 生成器の区画だけを除く(fork の区画を受け口にしないファイル用)
 */
export function stripOwnedRegions(text, { fork = true } = {}) {
  const all = [...(fork ? parseForkRegions(text).regions : []), ...parseGeneratorRegions(text)];
  const lines = text.split("\n");
  return lines.filter((_, index) => !isInForkRegion(all, index + 1)).join("\n");
}

/**
 * 行番号(1 始まり)が区画の中(印の行を除く)にあるか。fork の区画にも生成器の区画にも使える。
 */
export function isInForkRegion(regions, line) {
  return regions.some((region) => line > region.start && line < region.end);
}

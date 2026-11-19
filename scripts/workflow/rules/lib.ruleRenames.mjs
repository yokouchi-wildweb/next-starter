// scripts/workflow/rules/lib.ruleRenames.mjs — 名の対応表(renames.json)を読み、ファイルの行の中の古い名を探す純な関数
// 対応表 = v2 の文脈の書き直しで消えた・移った名(決まりの鍵・CLAUDE.md の節・README の見出し・古い core のファイル)→ 新しい置き場。
// 読み手は staleRefs.mjs(pnpm workflow rules staleRefs、読むだけ)。表は区切り v2-switch の notice が名指す

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 対応表の 1 件から、行を照らす正規表現を作る。
 * - core-file: 古いパスそのもの
 * - claude-section / rule-key: 「CLAUDE.md <節> [<鍵>]」か「<file> <鍵>」の字面(間の空白と記号は 1〜3 字まで許す)
 * - readme-heading: 「<パス>「<見出し>」」そのもの、または「「<見出し>」」で同じ行にそのファイルの名(README は README)とフォルダの名がある時(新しい名指しそのものは除く)
 * @param {{ kind: string, old: string }} entry
 * @returns {{ test: (line: string) => boolean }}
 */
export function matcherOf(entry) {
  if (entry.kind === "readme-heading") {
    const at = entry.old.indexOf("「");
    const path = entry.old.slice(0, at);
    const heading = entry.old.slice(at);
    const folder = path.split("/").slice(-2, -1)[0] ?? "";
    const base = path.split("/").pop() ?? "";
    const already = entry.new.includes("「") ? entry.new : null; // 新しい名指しそのものは古くない
    return {
      test: (line) =>
        line.includes(entry.old) ||
        (line.includes(heading) && folder !== "" && line.includes(folder) && line.includes(base === "README.md" ? "README" : base) && !(already && line.includes(already))),
    };
  }
  if (entry.kind === "core-file") return { test: (line) => line.includes(entry.old) };
  const words = entry.old.replace(/\s*\(.*\)$/, "").split(/\s+/).map(escape);
  const pattern = new RegExp(`(?:^|[^A-Za-z_])${words.join("[\\s`「」'\"(（の]{1,3}")}(?![A-Za-z_])`);
  return { test: (line) => pattern.test(line) };
}

/**
 * ファイルの中身から古い名の行を挙げる
 * @param {string} path
 * @param {string} text
 * @param {{ kind: string, old: string, new: string }[]} entries
 * @returns {{ path: string, line: number, old: string, new: string, kind: string }[]}
 */
export function staleRefsIn(path, text, entries) {
  const matchers = entries.map((entry) => ({ entry, matcher: matcherOf(entry) }));
  const hits = [];
  text.split("\n").forEach((line, index) => {
    for (const { entry, matcher } of matchers) {
      if (matcher.test(line)) hits.push({ path, line: index + 1, old: entry.old, new: entry.new, kind: entry.kind });
    }
  });
  return hits;
}

/** 見る対象のファイルか(.notices と docs/journal は記録なので見ない、上流の core と札は上流の物) */
export function isStaleRefTarget(path) {
  if (path.startsWith(".notices/") || path.startsWith("docs/journal/")) return false;
  if (path.startsWith(".claude/rules/core/") || path.startsWith(".claude/rules/items/")) return false;
  return /\.(md|mdx|ts|tsx|mts|mjs|js|cjs|json|txt|css)$/.test(path);
}

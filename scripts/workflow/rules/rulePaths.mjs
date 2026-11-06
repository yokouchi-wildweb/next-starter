// scripts/workflow/rules/rulePaths.mjs
// パス指定ルール(.claude/rules/**/*.md の frontmatter `paths:`)を読む部品。
// pnpm test:core-rules(今の木の契約)と pnpm notices:hotfix-check(遅れた fork の木で当たるか)が共有する。
import { matchesGlob } from "node:path";

// 先頭の frontmatter から `paths:` の配列を取り出す(`  - "glob"` 形式のみ)
export function parsePaths(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const start = lines.indexOf("paths:");
  if (start < 0) return null;
  const paths = [];
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^\s+-\s+"([^"]+)"\s*$/);
    if (!item) break;
    paths.push(item[1]);
  }
  return paths;
}

// ワイルドカードを含む最初の区切りより前の固定部分(例: "src/features/*/room/**" → "src/features")
export function staticPrefix(pattern) {
  const segs = pattern.split("/");
  const i = segs.findIndex((s) => /[*?[{]/.test(s));
  return i < 0 ? null : segs.slice(0, i).join("/");
}

// paths の各 glob のうち、files(追跡中のファイルの一覧)のどれにも当たらないもの
export function unmatchedPaths(paths, files) {
  return paths.filter((p) => !files.some((f) => matchesGlob(f, p)));
}

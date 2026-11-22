// scripts/workflow/rules/lib.rulePaths.mjs
// パス指定ルール(.claude/rules/**/*.md の frontmatter `paths:`)を読む部品。
// pnpm check rules(今の木の契約)と scripts/workflow/notices/lib.hotfixGaps.mjs(緊急修正・先に取れる修正を載せた木で当たるか)が共有する。
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

// ワイルドカードを含む最初の区切りより前の固定部分(例: "src/domains/*/room/**" → "src/domains")
export function staticPrefix(pattern) {
  const segs = pattern.split("/");
  const i = segs.findIndex((s) => /[*?[{]/.test(s));
  return i < 0 ? null : segs.slice(0, i).join("/");
}

// 入れ子の波かっこ(1 つの { … } の中に別の { がある)か。Claude Code の paths は入れ子を当てない(1 段は中に ** や / を含んでも当たる)。
// 検査の照合(node の matchesGlob)は入れ子も当てるので、ここで別に止める。\{ のエスケープは数えない
export function nestedBrace(glob) {
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") {
      depth++;
      if (depth > 1) return true;
    } else if (c === "}" && depth > 0) depth--;
  }
  return false;
}

// Claude Code の paths の読み込みと同じ照合: ** と * は点で始まる名(.gitkeep・.npmrc)と点で始まるフォルダ(.codex/)にも当たる
// (注文 59 で claude -p に読ませて確かめた、D225)。node の matchesGlob は点の段に当てないので、点で始まる段を同じ印に置き換えてから照らす
const DOT = "\u0001";
const undot = (s) => s.split("/").map((seg) => (seg.startsWith(".") && seg !== "." && seg !== ".." ? DOT + seg.slice(1) : seg)).join("/");
export const matchesLoad = (path, glob) => matchesGlob(undot(path), undot(glob));

// paths の各 glob のうち、files(追跡中のファイルの一覧)のどれにも当たらないもの
export function unmatchedPaths(paths, files) {
  return paths.filter((p) => !files.some((f) => matchesLoad(f, p)));
}

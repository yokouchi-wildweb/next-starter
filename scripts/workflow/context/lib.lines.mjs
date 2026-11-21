// scripts/workflow/context/lib.lines.mjs
//
// 文脈の行と memo の事実に共通の部品(pnpm workflow context facts と pnpm workflow memory facts が使う)。読むだけ、判断しない。
// - repoTop / mainCheckout / claudeConfigDir: 道を決める(ワークツリーから走らせても本体の道)
// - splitFrontmatter: frontmatter と本文
// - pathRefs / commitRefs / checkRefs: 文の中のパス・コミットらしい語と、その実在
// - sameText / sameLines: 同じ字面の行を持つリポの追跡ファイル(path:line)
// - listShort: 一覧を 3 件までの 1 語に
// 規則と使い方: scripts/workflow/context/README.md

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const SAME_MIN_CHARS = 20;
const LIST_MAX = 3;

export const git = (cwd, args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** このリポの今の作業木の根(git の外なら cwd) */
export const repoTop = (cwd) => git(cwd, ["rev-parse", "--show-toplevel"]) ?? cwd;

/** 本体のチェックアウトの道: git の共有の .git の親(ワークツリーでも本体を指す)。git の外なら cwd */
export const mainCheckout = (cwd) => {
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return common ? path.dirname(common) : cwd;
};

/** Claude Code の設定の置き場: CLAUDE_CONFIG_DIR か ~/.claude */
export const claudeConfigDir = (env = process.env) => env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude");

/** frontmatter と本文に分ける(frontmatter が無ければ空)。frontLines = frontmatter が占める行数(区切りの行も) */
export const splitFrontmatter = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { front: m[1], body: text.slice(m[0].length), frontLines: m[0].split("\n").length - (m[0].endsWith("\n") ? 1 : 0) } : { front: "", body: text, frontLines: 0 };
};

/** 文からパスらしい語(/ を含み、拡張子か ~/ / ./ ../ / の始まりか / の終わり)。URL と仮の名(<> *)は除く */
export const pathRefs = (body) => {
  const text = body.replace(/https?:\/\/\S+/g, " ");
  const found = new Set();
  for (const m of text.matchAll(/(?:~\/|\.{1,2}\/|\/)?[\w.@\-[\]()!+]+(?:\/[\w.@\-[\]()!+]+)+\/?/g)) {
    let p = m[0].replace(/[.,:;)]+$/, "");
    if (p.startsWith("(") && !p.includes(")")) p = p.slice(1); // 括弧書きの始まり「(core/x.md」
    const next = text[m.index + m[0].length] ?? "";
    if (/[<>*]/.test(p) || /[<*]/.test(next) || !p.includes("/")) continue; // 仮の名(<name> や *)の手前で切れた語
    const marked = /^(~\/|\.{1,2}\/|\/)/.test(p) || p.endsWith("/") || /\.[A-Za-z0-9]{1,6}$/.test(p);
    if (marked) found.add(p);
  }
  return [...found];
};

/** 文からコミットらしい語(7〜40 桁の 16 進で、数字と a-f の両方を含む) */
export const commitRefs = (body) => {
  const found = new Set();
  for (const m of body.matchAll(/\b[0-9a-f]{7,40}\b/g)) if (/\d/.test(m[0]) && /[a-f]/.test(m[0])) found.add(m[0]);
  return [...found];
};

const resolveRef = (p, top) => (p.startsWith("~/") ? path.join(homedir(), p.slice(2)) : path.isAbsolute(p) ? p : path.join(top, p));

/** 参照の実在: 在る数・全数・無い物(相対のパスは top から解く。alsoUnder = top の下で次に試すフォルダ) */
export const checkRefs = (body, top, { alsoUnder = [] } = {}) => {
  const gone = [];
  let total = 0;
  for (const p of pathRefs(body)) {
    total++;
    const found = existsSync(resolveRef(p, top)) || (!/^(~\/|\/)/.test(p) && alsoUnder.some((dir) => existsSync(path.join(top, dir, p))));
    if (!found) gone.push(p);
  }
  for (const c of commitRefs(body)) {
    total++;
    if (git(top, ["cat-file", "-e", `${c}^{commit}`]) === null) gone.push(c);
  }
  return { exist: total - gone.length, total, gone };
};

/** 行頭の箇条・見出し・引用の印を除いた行の字面 */
export const lineText = (line) => line.replace(/^\s*(?:>\s*)?(?:#+|[-*]|\d+\.)\s+/, "").trim();

/** 1 つの字面(20 字以上)と同じ文字列を持つリポの追跡ファイルの行(path:line)。短い字面は [] */
export const sameText = (text, top) => {
  if ([...text].length < SAME_MIN_CHARS) return [];
  const out = git(top, ["grep", "-F", "-n", "-I", "-e", text]);
  return out ? out.split("\n").map((row) => row.split(":").slice(0, 2).join(":")) : [];
};

/** 本文の 20 字以上の行と同じ行を持つリポの追跡ファイル(path:line) */
export const sameLines = (body, top) => {
  const hits = new Set();
  for (const l of new Set(body.split(/\r?\n/).map(lineText))) for (const hit of sameText(l, top)) hits.add(hit);
  return [...hits];
};

/** 一覧を 3 件までの 1 語に(多ければ …) */
export const listShort = (xs) => xs.slice(0, LIST_MAX).join(",") + (xs.length > LIST_MAX ? ",…" : "");

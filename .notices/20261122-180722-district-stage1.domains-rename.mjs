#!/usr/bin/env node
// .notices/20261122-180722-district-stage1.domains-rename.mjs
// ドメインの置き場の改名 features → domains(地区の議会 段 1、D10・D43)。上流(Tier1)も fork も同じ道具で、リポのルートで走らせる。
// (notice .notices/20261122-180722-district-stage1.md の uses: の道具。fork が取り込みの merge の途中に走らせる。上流は出荷の次の commit で消す)
// 使い方: node .notices/20261122-180722-district-stage1.domains-rename.mjs [--apply] [--json] [--base <sha>]
//   既定は dry-run(移動・書き換えの計画と止める一覧を出すだけ、何も書かない)。--apply で書き換え → 移動の順に書く。
//   --base <sha> = 取り込みの merge を先に commit した時(鉄道・艦隊の取り込みなど)の 3 方向の merge の基準(取り込み前の fork と
//   上流の merge-base: 取り込みの merge commit を M として `git merge-base M^1 M^2`)。merge の途中(MERGE_HEAD がある)なら
//   MERGE_HEAD との merge-base が勝ち、--base は使わない
//   何度走らせても同じ結果(2 回目の --apply は何も変えない。止める一覧は残る)
//
// 動かす物(フォルダごと。fork が足したファイルも一緒に動く。git の木なら git mv):
// - src/features → src/domains
// - src/config/features → src/config/domains
// - .claude/rules/items/features → .claude/rules/items/domains(機能の札の置き場、D43。fork が自分で書いた札も動く)
//   移す先が無ければフォルダごと。移す先が既にある時(fork が段 1 の区間を取り込んだ後: 上流の分は取り込みで src/domains にあり、
//   fork が足した物と fork が値を変えた上流のファイルが src/features に残る)はファイルごとに移す:
//   - 移す先に無いファイル → 移す
//   - 移す先にもあるファイル → 3 方向の merge(git merge-file): 自分 = 書き換えた後の fork の版、基準 = 取り込みの merge の基準
//     (MERGE_HEAD との merge-base)の版を同じ形で書き換えた物、相手 = 移す先の上流の版。食い違えば書かずに止める(stop: merge-conflict)。
//     merge を先に commit した時は --base の版が基準(同じ 3 方向の merge)。
//     基準が無い(merge の途中でなく --base も無い)時は、書き換えた fork の版が移す先と同じなら古い方を消すだけ、違えば止める(stop: both-exist)
//   (小さいファイルは道の行の書き換えで似ている割合が git の改名の見つけの線(50%)を下回り、取り込みで modify/delete の衝突になる。
//    git の改名の上限 renameLimit の問題ではないので、この道具が新しい道に置く)
//   ファイルごとに動かした道は git add -A で索引に載せる(取り込みの merge の衝突もここで解ける)
//
// 書き換える形(文字列のパスだけ。語としての feature(門番の機能)は触らない。`\/` の正規表現の字面も同じに読む):
// - srcPath:  src/features(後ろが / か語の終わり)→ src/domains
// - alias:    @/features(同)→ @/domains
// - config:   config/features(src/config/features・@/config/features。同)→ config/domains
// - card:     items/features(.claude/rules/items/features・文書の items/features/<name>.md。同)→ items/domains
// - brace:    src/ か config/ の直後の波かっこの並びの要素 features(src/config/{lib,features,layout}・eslint の files の glob)→ domains
// - bare:     前に語・/・@・. の無い features/ で、後ろの部品が英数字でない(<domain>・*・（ など)か今あるドメインのフォルダ名(core を含む)
//             の物 → domains/(文書とコメントの features/<domain>/… の書き方)。後ろが知らない名前の features/ は止める
// - relative: 相対の指定子 ../features/・./features/ は、ファイルの置き場から解いて src/features か src/config/features に当たる物だけ
//             → domains。解いた先が違う(テストの作り物の中の指定子など)なら止める
// - lintName: lint のルール名 lib-no-features → lib-no-domains・hooks-utils-no-features → hooks-utils-no-domains・
//             features-index-no-server-reexport → domains-index-no-server-reexport(D50)(eslint-disable の行も)
// 対象のファイル: git の木なら git ls-files -co --exclude-standard(追跡中と無視されていない新規)、でなければ下の SKIP_DIRS を除いた全部。
//   文字のファイルだけ(画像・フォントなどの拡張子と NUL を含む物は見ない)。fork の .fork-ownership/*.permits.txt・intake.txt・
//   tsconfig.json・.claude/rules(core・カード・自前の規則)・README・docs も同じ形で書き換える
//
// 見ない物(書き換えない):
// - 出荷済みの notice の本文と道具(.notices/<YYYYMMDD-HHMMSS>-…)・取り込みの台帳と記録(.notices/ の下の README のほか: applied/・shipped/・done/)・この道具自身とそのテスト
// - 日付つきの記録 docs/journal/(当時の事実、D47)・語の表 scripts/workflow/terms/(誤りの字面を持つ)・pnpm-lock.yaml
// - 名前が renames.json のファイルの "old": の行(改名の記録の旧い名は当時の名のまま。"new" は今の置き場なので書き換える)
//
// 止める物(書き換えず、候補つきで一覧に出す。手で決めてから --apply をもう一度):
// - lone:     "features" 1 語の文字列(join("src", "features") の類。門番の機能の意味の物もあるので道具は決めない)
// - bare:     上の bare の条件に当たらない features/(後ろが知らない名前)
// - relative: 解いた先が src/features・src/config/features でない相対の features/
// - leftover: 書き換えた後に残る features/(上のどれでもない形。scripts/operations/features/(門番の機能の道具)は除く)
// - merge-conflict: 移す先にもあるファイルの 3 方向の merge が食い違う(手で移す先に合わせてから古い方を消す)
// - both-exist: 基準が無いのに移す先にも違う中身のファイルがある(同)
//
// fork の手順: 上流の段 1 の notice の区間を取り込む → dry-run → 止めた物を片付ける(自分のコードなら直す、門番の機能の意味なら残す)
//   → --apply → notice の required_actions(生成の作り直しと検査)。上流の分は取り込みで動いているので、この道具が動かすのは fork が足した物

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { readForkIdentity } from "../src/lib/forkOwnership/forkIds.mjs";

export const MOVES = [
  { from: "src/features", to: "src/domains" },
  { from: "src/config/features", to: "src/config/domains" },
  { from: ".claude/rules/items/features", to: ".claude/rules/items/domains" },
];
export const LINT_RENAMES = [
  ["hooks-utils-no-features", "hooks-utils-no-domains"],
  ["lib-no-features", "lib-no-domains"],
  ["features-index-no-server-reexport", "domains-index-no-server-reexport"],
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage", ".vercel"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|svgz|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp4|webm|mov|mp3|wav|ogg|wasm|sqlite|db)$/i;
const TEXT_EXT = /\.(m?[jt]sx?|c[jt]s|mts|json|jsonl|md|mdx|txt|css|scss|ya?ml|html|sql|sh)$/i; // 文字のファイル: NUL を含んでも読む(ソースに join("\0") の NUL を直に書いた物がある)
const NOTICE_ID = /^\.notices\/\d{8}-\d{6}-/;
const SELF = /^\.notices\/20261122-180722-district-stage1\./; // 同じ notice の道具とテスト(本文の id の形なので shipped-notice にも当たる)
const SELF_ID = basename(fileURLToPath(import.meta.url)).replace(/\.domains-rename\.mjs$/, "");

/** 見ない物か(理由か null) */
export function skipReason(path) {
  if (SELF.test(path) || path.startsWith(`.notices/${SELF_ID}.domains-rename.`)) return "self";
  if (NOTICE_ID.test(path)) return "shipped-notice";
  // 取り込みの台帳(applied/)・中間 Tier の出荷の台帳(shipped/)・済んだ注文(done/)など .notices の下は README のほか全部が記録
  if (path.startsWith(".notices/") && path !== ".notices/README.md") return "notices-record";
  if (path.startsWith("docs/journal/")) return "journal";
  if (path.startsWith("scripts/workflow/terms/")) return "terms"; // 語の表(誤りの字面を持つ)
  if (path === "pnpm-lock.yaml" || path.endsWith("/pnpm-lock.yaml")) return "lockfile";
  if (BINARY.test(path)) return "binary";
  return null;
}

/** 対象のファイル(root 相対、posix) */
export function listFiles(root) {
  if (existsSync(join(root, ".git"))) {
    const out = execFileSync("git", ["ls-files", "-z", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    return [...new Set(out.split("\0").filter(Boolean))].filter((p) => existsSync(join(root, p)) && statSync(join(root, p)).isFile());
  }
  const files = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  walk("");
  return files;
}

/** 今あるドメインのフォルダ名(src/features と src/features/core の直下。移した後なら src/domains) */
export function domainNames(root) {
  const names = new Set(["core"]);
  for (const base of ["src/features", "src/features/core", "src/domains", "src/domains/core"]) {
    const abs = join(root, base);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true })) if (entry.isDirectory()) names.add(entry.name);
  }
  return names;
}

const S = String.raw`(?:\/|\\\/)`; // / か正規表現の字面の \/
const END = String.raw`(?![A-Za-z0-9_-])`;
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const excerpt = (text, index) => {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 160);
};

/**
 * 1 ファイルの書き換え(純関数)
 * @param {string} path root 相対(相対の指定子を解くのに使う)
 * @param {string} text 中身
 * @param {Set<string>} names ドメインのフォルダ名(bare の判定)
 * @returns {{ text: string, counts: Record<string, number>, stops: { line: number, kind: string, text: string, suggest?: string }[] }}
 */
export function rewriteText(path, text, names) {
  const counts = {};
  const stops = [];
  const bump = (kind) => (counts[kind] = (counts[kind] ?? 0) + 1);
  let out = text;

  // relative(先に: ../features/ を bare と取り違えない)
  out = out.replace(new RegExp(String.raw`((?:\.\.?${S})+)features(?=${S}|["'\`])`, "g"), (match, dots, offset, whole) => {
    const parts = dots.replace(/\\\//g, "/").split("/").filter(Boolean);
    const resolved = posix.normalize(posix.join(posix.dirname(path), ...parts));
    if (resolved === "src" || resolved === "src/config") {
      bump("relative");
      return `${dots}domains`;
    }
    stops.push({ line: lineOf(whole, offset), kind: "relative", text: excerpt(whole, offset), suggest: `解いた先 ${resolved}/features(src/features でない)` });
    return match;
  });
  // srcPath・alias・config
  out = out.replace(new RegExp(String.raw`src${S}features${END}`, "g"), (m) => (bump("srcPath"), m.replace(/features$/, "domains")));
  out = out.replace(new RegExp(String.raw`@${S}features${END}`, "g"), (m) => (bump("alias"), m.replace(/features$/, "domains")));
  out = out.replace(new RegExp(String.raw`config${S}features${END}`, "g"), (m) => (bump("config"), m.replace(/features$/, "domains")));
  out = out.replace(new RegExp(String.raw`items${S}features${END}`, "g"), (m) => (bump("card"), m.replace(/features$/, "domains")));
  out = out.replace(new RegExp(String.raw`((?:src|config)${S}\{)([^{}\n]*)\}`, "g"), (m, head, list) => {
    const parts = list.split(",");
    if (!parts.some((x) => x.trim() === "features")) return m;
    bump("brace");
    return `${head}${parts.map((x) => (x.trim() === "features" ? x.replace("features", "domains") : x)).join(",")}}`;
  });
  // bare
  out = out.replace(new RegExp(String.raw`(?<![A-Za-z0-9_@./\\-])features(${S})`, "g"), (match, sep, offset, whole) => {
    const rest = whole.slice(offset + match.length);
    const next = /^[A-Za-z0-9_-]+/.exec(rest)?.[0];
    const ok = next === undefined || names.has(next);
    if (ok) {
      bump("bare");
      return `domains${sep}`;
    }
    stops.push({ line: lineOf(whole, offset), kind: "bare", text: excerpt(whole, offset), suggest: `features/${next ?? ""} の ${next ?? "(空)"} はドメインのフォルダでない` });
    return match;
  });
  // lintName
  for (const [from, to] of LINT_RENAMES) {
    out = out.replace(new RegExp(String.raw`(?<![A-Za-z0-9_-])${from}${END}`, "g"), () => (bump("lintName"), to));
  }
  // 止める物: lone と leftover(書き換えた後の文で数える)
  for (const m of out.matchAll(/(["'`])features\1/g)) {
    stops.push({ line: lineOf(out, m.index), kind: "lone", text: excerpt(out, m.index), suggest: "フォルダの部品なら domains に、門番の機能の意味なら残す" });
  }
  for (const m of out.matchAll(new RegExp(String.raw`(?<![A-Za-z0-9_-])features${END}`, "g"))) {
    const after = out.slice(m.index + "features".length, m.index + "features".length + 2);
    if (!/^(\/|\\\/)/.test(after)) continue; // フォルダとして続く物だけ(features.ts・"features の …" は見ない)
    // 門番の機能の道具 scripts/operations/features
    if (/operations(\/|\\\/)$/.test(out.slice(Math.max(0, m.index - 12), m.index))) continue;
    if (stops.some((s) => s.line === lineOf(out, m.index) && (s.kind === "bare" || s.kind === "relative"))) continue;
    stops.push({ line: lineOf(out, m.index), kind: "leftover", text: excerpt(out, m.index) });
  }
  return { text: out, counts, stops };
}

const LINEAGE = ".claude/rules/lineage.md";
/**
 * lineage.md は祖先の節を書かない: Tier1(tier root)は全体、fork は自分の節(## <repo_id> 〜 <!-- end <repo_id> -->)だけを書き換える
 * (祖先の節と前書きは祖先が自分の取り込みで直して届ける。fork が書けば所有の違反)
 */
export function rewriteLineage(text, own, isRoot, rewrite) {
  if (isRoot) return rewrite(text);
  if (!own) return { text, counts: {}, stops: [] };
  const head = `## ${own}\n`;
  const start = text.startsWith(head) ? 0 : text.indexOf(`\n${head}`) + 1;
  if (start === 0 && !text.startsWith(head)) return { text, counts: {}, stops: [] }; // 自分の節が無い
  const endAt = text.indexOf(`<!-- end ${own} -->`, start);
  const end = endAt < 0 ? text.length : endAt;
  const r = rewrite(text.slice(start, end));
  const offset = text.slice(0, start).split("\n").length - 1;
  return { text: text.slice(0, start) + r.text + text.slice(end), counts: r.counts, stops: r.stops.map((s) => ({ ...s, line: s.line + offset })) };
}

/**
 * renames.json(改名の記録)は "old": の行を書かない: 旧い名は当時の名のまま読まれる(staleRefs が旧い名指しを探す)。
 * "old": の行を印に置き換えて書き換え、戻す(1 行 = 1 行なので止めの行番号は変わらない)
 */
export function rewriteKeepingOld(text, rewrite) {
  const kept = [];
  const masked = text.replace(/^[ \t]*"old"[ \t]*:.*$/gm, (line) => `\u0000${kept.push(line) - 1}\u0000`);
  const r = rewrite(masked);
  return { ...r, text: r.text.replace(/\u0000(\d+)\u0000/g, (_m, i) => kept[Number(i)]) };
}

/** 1 ファイルの書き換え(lineage.md は自分の節だけ、renames.json は "old" の行を残す) */
function fileRewriter(root, names) {
  const ident = readForkIdentity(root);
  const one = (path, text) => (path === LINEAGE ? rewriteLineage(text, ident.own, ident.tier === "root", (t) => rewriteText(path, t, names)) : rewriteText(path, text, names));
  return (path, text) => (basename(path) === "renames.json" ? rewriteKeepingOld(text, (t) => one(path, t)) : one(path, text));
}

/** フォルダの下にファイルが 1 つも無いか */
function listEmpty(abs) {
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.isFile()) return false;
    if (entry.isDirectory() && !listEmpty(join(abs, entry.name))) return false;
  }
  return true;
}

/**
 * 取り込みの merge の基準の版を読む関数。基準 = merge の途中なら MERGE_HEAD との merge-base(勝つ)、そうでなければ base(--base、
 * merge を先に commit した取り込みの merge-base)。どちらも無ければ null を返す関数
 * @param {string} root
 * @param {{ base?: string | null }} [opts]
 */
export function mergeBaseReader(root, { base: given = null } = {}) {
  if (!existsSync(join(root, ".git"))) return () => null;
  const head = spawnSync("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"], { cwd: root, encoding: "utf8" });
  let base = "";
  if (head.status === 0) base = spawnSync("git", ["merge-base", "HEAD", "MERGE_HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  else if (given) base = resolveBase(root, given);
  if (!base) return () => null;
  return (path) => {
    const r = spawnSync("git", ["show", `${base}:${path}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
  };
}

/** --base の sha を commit に解く(解けなければ投げる: 打ち間違いの基準で黙って both-exist に落とさない) */
export function resolveBase(root, given) {
  const r = spawnSync("git", ["rev-parse", "-q", "--verify", `${given}^{commit}`], { cwd: root, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim()) throw new Error(`--base ${given} は commit に解けません(取り込みの merge-base: git merge-base <merge commit>^1 <merge commit>^2)`);
  return r.stdout.trim();
}

/** 3 方向の merge(git merge-file -p)。戻り: { text, conflicts } */
export function mergeFile(ours, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), "domains-rename-"));
  try {
    writeFileSync(join(dir, "ours"), ours);
    writeFileSync(join(dir, "base"), base);
    writeFileSync(join(dir, "theirs"), theirs);
    const r = spawnSync("git", ["merge-file", "-p", "-L", "fork", "-L", "base", "-L", "upstream", join(dir, "ours"), join(dir, "base"), join(dir, "theirs")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status < 0 || r.status === null || r.error) throw new Error(`git merge-file: ${r.error?.message ?? r.stderr}`);
    return { text: r.stdout, conflicts: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 移す先にもある 1 ファイル: fork の版(書き換えた後)・基準の版(同じ形で書き換えた物)・移す先の上流の版の 3 方向の merge
 * @returns {{ text?: string, same?: boolean, stop?: { kind: string, text: string, suggest: string } }}
 */
function mergeOne(root, from, to, rewriteFile, baseText) {
  const ours = rewriteFile(from, readFileSync(join(root, from), "utf8")).text;
  const theirs = readFileSync(join(root, to), "utf8");
  if (ours === theirs) return { text: theirs, same: true };
  const baseRaw = baseText(from);
  if (baseRaw === null) {
    return { stop: { kind: "both-exist", text: `${from} と ${to} の中身が違う(取り込みの merge の基準が無い)`, suggest: `merge を commit 済みなら --base <取り込みの merge-base> で 3 方向の merge、そうでなければ ${to} に fork の変更を手で移してから ${from} を消す` } };
  }
  const base = rewriteFile(from, baseRaw).text;
  const merged = mergeFile(ours, base, theirs);
  if (merged.conflicts > 0) {
    return { stop: { kind: "merge-conflict", text: `${from} → ${to} の 3 方向の merge が ${merged.conflicts} か所食い違う`, suggest: `${to} に fork の変更を手で合わせてから ${from} を消す` } };
  }
  return { text: merged.text };
}

/** 計画(何も書かない) */
export function planRename(root, { baseText = mergeBaseReader(root) } = {}) {
  const rewriteFile = fileRewriter(root, domainNames(root));
  const files = listFiles(root);
  const moves = [];
  const stops = [];
  for (const move of MOVES) {
    if (!existsSync(join(root, move.from))) continue;
    const inside = files.filter((f) => f.startsWith(`${move.from}/`));
    const target = join(root, move.to);
    if (!(existsSync(target) && readdirSync(target).length > 0)) {
      moves.push({ ...move, mode: "folder", files: inside.length });
      continue;
    }
    // 移す先がある: ファイルごと
    const items = [];
    for (const from of inside) {
      const to = `${move.to}${from.slice(move.from.length)}`;
      if (!existsSync(join(root, to))) {
        items.push({ from, to, how: "move" });
        continue;
      }
      const merged = mergeOne(root, from, to, rewriteFile, baseText);
      if (merged.stop) stops.push({ path: from, line: 0, ...merged.stop });
      else items.push({ from, to, how: merged.same ? "same" : "merge" });
    }
    moves.push({ ...move, mode: "files", files: items.length, items });
  }
  const edits = [];
  const skipped = {};
  const totals = {};
  for (const path of files) {
    const reason = skipReason(path);
    if (reason) {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }
    const buffer = readFileSync(join(root, path));
    if (buffer.includes(0) && !TEXT_EXT.test(path)) {
      skipped.binary = (skipped.binary ?? 0) + 1;
      continue;
    }
    const text = buffer.toString("utf8");
    if (!/features/.test(text)) continue;
    const result = rewriteFile(path, text);
    for (const s of result.stops) stops.push({ path, ...s });
    if (result.text !== text) {
      edits.push({ path, counts: result.counts });
      for (const [kind, n] of Object.entries(result.counts)) totals[kind] = (totals[kind] ?? 0) + n;
    }
  }
  return { moves, edits, totals, stops, skipped };
}

/** 計画を当てる: 書き換え(移す前の場所で)→ 移動 */
export function applyRename(root, plan, { baseText = mergeBaseReader(root) } = {}) {
  const rewriteFile = fileRewriter(root, domainNames(root));
  for (const edit of plan.edits) {
    const abs = join(root, edit.path);
    writeFileSync(abs, rewriteFile(edit.path, readFileSync(abs, "utf8")).text);
  }
  const isGit = existsSync(join(root, ".git"));
  const staged = [];
  for (const move of plan.moves.filter((m) => m.mode === "files")) {
    for (const item of move.items) {
      const from = join(root, item.from);
      const to = join(root, item.to);
      if (item.how === "move") {
        mkdirSync(dirname(to), { recursive: true });
        renameSync(from, to);
      } else {
        // merge / same: 書き換えの後の fork の版で 3 方向の merge をやり直して書く(計画の時と同じ入力)
        if (item.how === "merge") writeFileSync(to, mergeOne(root, item.from, item.to, rewriteFile, baseText).text);
        rmSync(from);
      }
      staged.push(item.from, item.to);
    }
    if (existsSync(join(root, move.from)) && listEmpty(join(root, move.from))) rmSync(join(root, move.from), { recursive: true });
  }
  if (isGit && staged.length) for (let i = 0; i < staged.length; i += 200) execFileSync("git", ["add", "-A", "--", ...staged.slice(i, i + 200)], { cwd: root, stdio: "ignore" });
  for (const move of plan.moves.filter((m) => m.mode !== "files")) {
    const from = join(root, move.from);
    const to = join(root, move.to);
    if (existsSync(to)) rmSync(to, { recursive: true }); // 空のフォルダだけ(中身があれば計画で止めている)
    mkdirSync(dirname(to), { recursive: true });
    const tracked = isGit && spawnSync("git", ["ls-files", "--error-unmatch", "--", move.from], { cwd: root, stdio: "ignore" }).status === 0;
    if (tracked) execFileSync("git", ["mv", move.from, move.to], { cwd: root, stdio: "ignore" });
    else renameSync(from, to);
  }
  return { moved: plan.moves.map((m) => m.to), edited: plan.edits.length };
}

/** 引数: --apply / --json / --base <sha>(--base=<sha> も) */
export function parseArgs(args) {
  let base = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") {
      base = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "";
      if (!base) throw new Error("--base には取り込みの merge-base の sha を渡す");
    } else if (args[i].startsWith("--base=")) base = args[i].slice("--base=".length);
  }
  return { apply: args.includes("--apply"), json: args.includes("--json"), base };
}

function main() {
  const root = process.cwd();
  let opts;
  let baseText;
  try {
    opts = parseArgs(process.argv.slice(2));
    baseText = mergeBaseReader(root, { base: opts.base });
  } catch (error) {
    console.error(`[domains-rename] ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const { apply } = opts;
  const plan = planRename(root, { baseText });
  const result = { mode: apply ? "apply" : "dry-run", ...plan };
  if (apply) Object.assign(result, applyRename(root, plan, { baseText }));
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const byKind = (list) => Object.entries(list.reduce((acc, s) => ((acc[s.kind] = (acc[s.kind] ?? 0) + 1), acc), {})).map(([k, n]) => `${k} ${n}`).join(" / ");
  console.log(`[domains-rename] ${result.mode}`);
  console.log(`移動: ${plan.moves.length} 件`);
  for (const m of plan.moves) console.log(`  ${m.from} → ${m.to}(${m.mode === "files" ? `ファイルごと ${m.files} ファイル: 移す ${m.items.filter((i) => i.how === "move").length}・3 方向の merge ${m.items.filter((i) => i.how === "merge").length}・同じ中身 ${m.items.filter((i) => i.how === "same").length}` : `${m.files} ファイル`})`);
  console.log(`書き換え: ${plan.edits.length} ファイル(${Object.entries(plan.totals).map(([k, n]) => `${k} ${n}`).join(" / ") || "なし"})`);
  console.log(`見ない物: ${Object.entries(plan.skipped).map(([k, n]) => `${k} ${n}`).join(" / ") || "なし"}`);
  console.log(`止めた物(書き換えない): ${plan.stops.length} 件${plan.stops.length ? `(${byKind(plan.stops)})` : ""}`);
  const shown = new Map();
  for (const s of plan.stops) {
    const key = `${s.kind}\0${s.path}`;
    const n = (shown.get(key) ?? 0) + 1;
    shown.set(key, n);
    if (n <= 3) console.log(`  [${s.kind}] ${s.path}:${s.line}  ${s.text}${s.suggest ? `  → ${s.suggest}` : ""}`);
  }
  for (const [key, n] of shown) if (n > 3) console.log(`  [${key.split("\0")[0]}] ${key.split("\0")[1]}: ほか ${n - 3} 件(--json で全部)`);
  if (!apply && plan.stops.length) console.log("止めた物を片付けてから --apply(止めた物はそのまま残しても --apply は他を書く)");
  if (apply) console.log("次: notice の required_actions(生成の作り直しと検査)");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

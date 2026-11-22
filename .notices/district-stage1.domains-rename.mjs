#!/usr/bin/env node
// .notices/district-stage1.domains-rename.mjs
// ドメインの置き場の改名 features → domains(地区の議会 段 1、D10・D43)。上流(Tier1)も fork も同じ道具で、リポのルートで走らせる。
// (区切りを閉じる commit で .notices/<その notice の id>.domains-rename.mjs に改名する。それまでの仮の id = 区切りの名前)
// 使い方: node .notices/district-stage1.domains-rename.mjs [--apply] [--json]
//   既定は dry-run(移動・書き換えの計画と止める一覧を出すだけ、何も書かない)。--apply で書き換え → 移動の順に書く。
//   何度走らせても同じ結果(2 回目の --apply は何も変えない。止める一覧は残る)
//
// 動かす物(フォルダごと。fork が足したファイルも一緒に動く。git の木なら git mv):
// - src/features → src/domains
// - src/config/features → src/config/domains
//   移す先に既にファイルがあれば移動を止める(stop: target-exists)
//
// 書き換える形(文字列のパスだけ。語としての feature(門番の機能)は触らない。`\/` の正規表現の字面も同じに読む):
// - srcPath:  src/features(後ろが / か語の終わり)→ src/domains
// - alias:    @/features(同)→ @/domains
// - config:   config/features(src/config/features・@/config/features。同)→ config/domains
// - bare:     前に語・/・@・. の無い features/ で、後ろの部品が英数字でない(<domain>・*・（ など)か今あるドメインのフォルダ名(core を含む)
//             の物 → domains/(文書とコメントの features/<domain>/… の書き方)。後ろが知らない名前の features/ は止める
// - relative: 相対の指定子 ../features/・./features/ は、ファイルの置き場から解いて src/features か src/config/features に当たる物だけ
//             → domains。解いた先が違う(テストの作り物の中の指定子など)なら止める
// - lintName: lint のルール名 lib-no-features → lib-no-domains・hooks-utils-no-features → hooks-utils-no-domains(eslint-disable の行も)
// 対象のファイル: git の木なら git ls-files -co --exclude-standard(追跡中と無視されていない新規)、でなければ下の SKIP_DIRS を除いた全部。
//   文字のファイルだけ(画像・フォントなどの拡張子と NUL を含む物は見ない)。fork の .fork-ownership/*.permits.txt・intake.txt・
//   tsconfig.json・.claude/rules(core・カード・自前の規則)・README・docs も同じ形で書き換える
//
// 見ない物(書き換えない):
// - 出荷済みの notice の本文と道具(.notices/<YYYYMMDD-HHMMSS>-…)・取り込みの台帳(.notices/applied/)・この道具自身とそのテスト
// - 日付つきの記録 docs/journal/(当時の事実、D47)・pnpm-lock.yaml
// - カードの置き場 .claude/rules/items/features/ の名前(動かすかは指示書の議会の判断、D43)。中のファイルの文字列のパスは書き換える
//
// 止める物(書き換えず、候補つきで一覧に出す。手で決めてから --apply をもう一度):
// - lone:     "features" 1 語の文字列(join("src", "features") の類。門番の機能の意味の物もあるので道具は決めない)
// - bare:     上の bare の条件に当たらない features/(後ろが知らない名前)
// - relative: 解いた先が src/features・src/config/features でない相対の features/
// - leftover: 書き換えた後に残る features/(上のどれでもない形。items/features/(カード)と scripts/operations/features/(門番の機能の道具)は除く)
// - target-exists: 移す先 src/domains・src/config/domains に既にファイルがある
//
// fork の手順: 上流の段 1 の notice の区間を取り込む → dry-run → 止めた物を片付ける(自分のコードなら直す、門番の機能の意味なら残す)
//   → --apply → notice の required_actions(生成の作り直しと検査)。上流の分は取り込みで動いているので、この道具が動かすのは fork が足した物

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export const MOVES = [
  { from: "src/features", to: "src/domains" },
  { from: "src/config/features", to: "src/config/domains" },
];
export const LINT_RENAMES = [
  ["hooks-utils-no-features", "hooks-utils-no-domains"],
  ["lib-no-features", "lib-no-domains"],
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage", ".vercel"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|svgz|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp4|webm|mov|mp3|wav|ogg|wasm|sqlite|db)$/i;
const NOTICE_ID = /^\.notices\/\d{8}-\d{6}-/;
const SELF = /^\.notices\/district-stage1\.domains-rename\./;
const SELF_ID = basename(fileURLToPath(import.meta.url)).replace(/\.domains-rename\.mjs$/, "");

/** 見ない物か(理由か null) */
export function skipReason(path) {
  if (SELF.test(path) || path.startsWith(`.notices/${SELF_ID}.domains-rename.`)) return "self";
  if (path.startsWith(".notices/applied/")) return "ledger";
  if (NOTICE_ID.test(path)) return "shipped-notice";
  if (path.startsWith("docs/journal/")) return "journal";
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
    // カードの置き場(D43)・門番の機能の道具 scripts/operations/features
    if (/(items|operations)(\/|\\\/)$/.test(out.slice(Math.max(0, m.index - 12), m.index))) continue;
    if (stops.some((s) => s.line === lineOf(out, m.index) && (s.kind === "bare" || s.kind === "relative"))) continue;
    stops.push({ line: lineOf(out, m.index), kind: "leftover", text: excerpt(out, m.index) });
  }
  return { text: out, counts, stops };
}

/** 計画(何も書かない) */
export function planRename(root) {
  const names = domainNames(root);
  const files = listFiles(root);
  const moves = [];
  const stops = [];
  for (const move of MOVES) {
    if (!existsSync(join(root, move.from))) continue;
    const target = join(root, move.to);
    if (existsSync(target) && readdirSync(target).length > 0) {
      stops.push({ path: move.to, line: 0, kind: "target-exists", text: `${move.from} → ${move.to}`, suggest: `${move.to} の中身を ${move.from} に戻すか片付けてからもう一度` });
      continue;
    }
    moves.push({ ...move, files: files.filter((f) => f.startsWith(`${move.from}/`)).length });
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
    if (buffer.includes(0)) {
      skipped.binary = (skipped.binary ?? 0) + 1;
      continue;
    }
    const text = buffer.toString("utf8");
    if (!/features/.test(text)) continue;
    const result = rewriteText(path, text, names);
    for (const s of result.stops) stops.push({ path, ...s });
    if (result.text !== text) {
      edits.push({ path, counts: result.counts });
      for (const [kind, n] of Object.entries(result.counts)) totals[kind] = (totals[kind] ?? 0) + n;
    }
  }
  return { moves, edits, totals, stops, skipped };
}

/** 計画を当てる: 書き換え(移す前の場所で)→ 移動 */
export function applyRename(root, plan) {
  const names = domainNames(root);
  for (const edit of plan.edits) {
    const abs = join(root, edit.path);
    writeFileSync(abs, rewriteText(edit.path, readFileSync(abs, "utf8"), names).text);
  }
  const isGit = existsSync(join(root, ".git"));
  for (const move of plan.moves) {
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

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const plan = planRename(root);
  const result = { mode: apply ? "apply" : "dry-run", ...plan };
  if (apply) Object.assign(result, applyRename(root, plan));
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const byKind = (list) => Object.entries(list.reduce((acc, s) => ((acc[s.kind] = (acc[s.kind] ?? 0) + 1), acc), {})).map(([k, n]) => `${k} ${n}`).join(" / ");
  console.log(`[domains-rename] ${result.mode}`);
  console.log(`移動: ${plan.moves.length} 件`);
  for (const m of plan.moves) console.log(`  ${m.from} → ${m.to}(${m.files} ファイル)`);
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

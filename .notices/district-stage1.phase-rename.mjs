#!/usr/bin/env node
// .notices/district-stage1.phase-rename.mjs
// 検査の段の語 gate → phase(段階)の移し替え(地区の議会の段 1、D19・D48)。上流(Tier1)も fork も同じ道具で、リポのルートで走らせる。
// (区切りを閉じる commit で .notices/<その notice の id>.phase-rename.mjs に改名する。それまでの仮の id = 区切りの名前)
// 使い方: node .notices/district-stage1.phase-rename.mjs [--apply] [--json]
//   既定は dry-run(移動・書き換えの計画と止める一覧を出すだけ、何も書かない)。--apply で書き換え → 移動の順に書く。
//   何度走らせても同じ結果(2 回目の --apply は何も変えない。止める一覧は残る)
//
// 動かす物(git の木なら git mv。移す先が既にあれば止める: target-exists):
// - 各対象の段の宣言 <フォルダ>/gate.json → <フォルダ>/phase.json(scripts の下の全部。fork が足した対象も)
// - 段のランナーの置き場 scripts/runner/gates → scripts/runner/phases、その中の段の一覧 gates.json → phases.json・gates.test.mjs → phases.test.mjs
//
// 書き換える形(門番 featureGate の語 gate・「門番」「門の規則」などは触らない):
// - flag:     --gate(後ろが英数字・- でない)→ --phase(--gate=ship・"--gate=" の字面・使い方の文)
// - file:     gate.json → phase.json・gates.json → phases.json(前が英数字でない時)
// - dir:      runner/gates(後ろが / か語の終わり)→ runner/phases
// - relative: 相対の指定子 ../gates/・./gates/ は、ファイルの置き場から解いて scripts/runner/gates に当たる物だけ → phases
// - key:      段の宣言(gate.json・phase.json)と段の一覧(gates.json・phases.json)の中のキー "gates" → "phases"
// - ja:       「門 <段の名前>」(build・build:post・ship・forge:pre・forge:post・deploy・nightly)→「段階 <段の名前>」
// - env:      段のランナーが子の検査に渡す段の名前の環境変数の読み env.GATE・env["GATE"] → env.PHASE・env["PHASE"](fork の検査器も読む)
// 対象のファイル: git の木なら git ls-files -co --exclude-standard、でなければ SKIP_DIRS を除いた全部。文字のファイルだけ
//
// 見ない物: 出荷済みの notice の本文と道具(.notices/<YYYYMMDD-HHMMSS>-…)・台帳と記録(.notices/ の下の README のほか: applied/・shipped/・done/)・この道具とテスト・
//   docs/journal(当時の記録、D47)・語の表 scripts/workflow/terms/(誤りの字面を持つ)・pnpm-lock.yaml・バイナリ
//
// 止める物(書き換えず候補つきで出す。手で決めてから --apply をもう一度):
// - ja:       段の文脈のファイル(gate.json・--gate・runner/gates・gates.json・phase の語を書くファイル)の中の、上の形でない「門」
//             (門番・門の規則・門の入口・門の外・門の機能・門の開・門の設定・門の依存・門で閉 は門番の意味、専門・部門 など前が漢字の物は別の語として数えない)
// - key:      段の文脈のファイルの、段の宣言の外の "gates" の字面(コードの KEYS・テストの作り物の宣言など。段の宣言のキーなら phases に)
// - target-exists: 移す先に既に物がある
//
// fork の手順: 上流の段 1 の notice の区間を取り込む → dry-run → 止めた物を片付ける → --apply → notice の required_actions

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { readForkIdentity } from "../src/lib/forkOwnership/forkIds.mjs";

export const RUNNER_FROM = "scripts/runner/gates";
export const RUNNER_TO = "scripts/runner/phases";
export const PHASE_NAMES = ["build:post", "build", "ship", "forge:pre", "forge:post", "deploy", "nightly"];
/** 門番(featureGate)の意味の「門」の続き(ja の止める一覧に数えない) */
const GATEKEEPER = /^(番|の規則|の入口|の外|の機能|の開|の設定|の依存|で閉|の名|が閉|を開|を閉)/;

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage", ".vercel"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|svgz|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp4|webm|mov|mp3|wav|ogg|wasm|sqlite|db)$/i;
const NOTICE_ID = /^\.notices\/\d{8}-\d{6}-/;
const SELF = /^\.notices\/district-stage1\./; // この道具と同じ区切りの道具(改名の後は .notices/<id>. の形で shipped-notice に入る)
const SELF_ID = basename(fileURLToPath(import.meta.url)).replace(/\.phase-rename\.mjs$/, "");

/** 見ない物か(理由か null) */
export function skipReason(path) {
  if (SELF.test(path) || path.startsWith(`.notices/${SELF_ID}.phase-rename.`)) return "self";
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

const END = String.raw`(?![A-Za-z0-9_-])`;
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const excerpt = (text, index) => {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 160);
};
/** 段の宣言か段の一覧のファイルか(キー "gates" を書き換える所) */
const isDeclaration = (path) => /(^|\/)(gate|phase|gates|phases)\.json$/.test(path);
/** 段の文脈のファイルか(ja の止める一覧を出す所) */
const PHASE_CONTEXT = /--gate|--phase|gate\.json|phase\.json|gates\.json|phases\.json|runner\/(gates|phases)/;

/**
 * 1 ファイルの書き換え(純関数)
 * @returns {{ text: string, counts: Record<string, number>, stops: { line: number, kind: string, text: string, suggest?: string }[] }}
 */
export function rewriteText(path, text) {
  const counts = {};
  const stops = [];
  const bump = (kind) => (counts[kind] = (counts[kind] ?? 0) + 1);
  const context = PHASE_CONTEXT.test(text) || isDeclaration(path);
  let out = text;

  out = out.replace(new RegExp(String.raw`((?:\.\.?\/)+)gates(?=\/)`, "g"), (match, dots) => {
    const resolved = posix.normalize(posix.join(posix.dirname(path), dots, "gates"));
    if (resolved !== RUNNER_FROM) return match;
    bump("relative");
    return `${dots}phases`;
  });
  out = out.replace(new RegExp(String.raw`--gate${END}`, "g"), () => (bump("flag"), "--phase"));
  out = out.replace(/(?<![A-Za-z0-9_-])gate\.json/g, () => (bump("file"), "phase.json"));
  out = out.replace(/(?<![A-Za-z0-9_-])gates\.json/g, () => (bump("file"), "phases.json"));
  out = out.replace(/(?<![A-Za-z0-9_-])gates\.test\.mjs/g, (m, offset, whole) => (/runner\/(gates|phases)\/$/.test(whole.slice(Math.max(0, offset - 15), offset)) || path.startsWith(RUNNER_FROM) || path.startsWith(RUNNER_TO) ? (bump("file"), "phases.test.mjs") : m));
  out = out.replace(new RegExp(String.raw`runner\/gates${END}`, "g"), () => (bump("dir"), "runner/phases"));
  out = out.replace(/(?<![A-Za-z0-9_$])env\.GATE(?![A-Za-z0-9_$])/g, () => (bump("env"), "env.PHASE"));
  out = out.replace(/env\[(["'])GATE\1\]/g, (_m, q) => (bump("env"), `env[${q}PHASE${q}]`));
  if (isDeclaration(path)) out = out.replace(/"gates"(\s*:)/g, (_m, colon) => (bump("key"), `"phases"${colon}`));
  const names = PHASE_NAMES.join("|");
  out = out.replace(new RegExp(String.raw`門( ?)(${names})${END}`, "g"), (_m, space, name) => (bump("ja"), `段階${space}${name}`));

  if (context) {
    for (const m of out.matchAll(/(?<![\u4E00-\u9FFF])門/g)) {
      if (GATEKEEPER.test(out.slice(m.index + 1, m.index + 5))) continue;
      stops.push({ line: lineOf(out, m.index), kind: "ja", text: excerpt(out, m.index), suggest: "段の意味なら段階に、門番の意味なら残す" });
    }
  }
  if (context && !isDeclaration(path)) {
    for (const m of out.matchAll(/["'`]gates["'`]/g)) {
      stops.push({ line: lineOf(out, m.index), kind: "key", text: excerpt(out, m.index), suggest: "段の宣言のキーなら phases に" });
    }
  }
  return { text: out, counts, stops };
}

/** 動かす物の計画(root 相対の from → to) */
function planMoves(root, files) {
  const moves = [];
  const stops = [];
  const add = (from, to) => {
    if (existsSync(join(root, to))) stops.push({ path: to, line: 0, kind: "target-exists", text: `${from} → ${to}`, suggest: `${to} を片付けてからもう一度` });
    else moves.push({ from, to });
  };
  const runnerHere = existsSync(join(root, RUNNER_FROM));
  for (const f of files) {
    if (!f.startsWith("scripts/") || basename(f) !== "gate.json") continue;
    add(f, `${dirname(f)}/phase.json`);
  }
  if (runnerHere) add(RUNNER_FROM, RUNNER_TO);
  // ランナーの中のファイル名(フォルダの移動の後の置き場で)
  const runnerDir = runnerHere ? RUNNER_FROM : RUNNER_TO;
  for (const [from, to] of [["gates.json", "phases.json"], ["gates.test.mjs", "phases.test.mjs"]]) {
    if (existsSync(join(root, runnerDir, from))) {
      const target = join(root, runnerDir, to);
      if (existsSync(target)) stops.push({ path: `${RUNNER_TO}/${to}`, line: 0, kind: "target-exists", text: `${from} → ${to}`, suggest: "片付けてからもう一度" });
      else moves.push({ from: `${RUNNER_TO}/${from}`, to: `${RUNNER_TO}/${to}`, afterDir: runnerHere });
    }
  }
  return { moves, stops };
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

/** 1 ファイルの書き換え(lineage.md は自分の節だけ) */
function fileRewriter(root) {
  const ident = readForkIdentity(root);
  return (path, text) => (path === LINEAGE ? rewriteLineage(text, ident.own, ident.tier === "root", (t) => rewriteText(path, t)) : rewriteText(path, text));
}

/** 計画(何も書かない) */
export function planRename(root) {
  const rewriteFile = fileRewriter(root);
  const files = listFiles(root);
  const { moves, stops } = planMoves(root, files);
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
    if (!/gate|GATE|門/.test(text)) continue;
    const result = rewriteFile(path, text);
    for (const s of result.stops) stops.push({ path, ...s });
    if (result.text !== text) {
      edits.push({ path, counts: result.counts });
      for (const [kind, n] of Object.entries(result.counts)) totals[kind] = (totals[kind] ?? 0) + n;
    }
  }
  return { moves, edits, totals, stops, skipped };
}

/** 計画を当てる: 書き換え(移す前の場所で)→ 移動(宣言 → ランナーのフォルダ → その中のファイル名) */
export function applyRename(root, plan) {
  const rewriteFile = fileRewriter(root);
  for (const edit of plan.edits) {
    const abs = join(root, edit.path);
    writeFileSync(abs, rewriteFile(edit.path, readFileSync(abs, "utf8")).text);
  }
  const isGit = existsSync(join(root, ".git"));
  const move = (from, to) => {
    mkdirSync(dirname(join(root, to)), { recursive: true });
    const tracked = isGit && spawnSync("git", ["ls-files", "--error-unmatch", "--", from], { cwd: root, stdio: "ignore" }).status === 0;
    if (tracked) execFileSync("git", ["mv", from, to], { cwd: root, stdio: "ignore" });
    else renameSync(join(root, from), join(root, to));
  };
  for (const m of plan.moves) {
    if (m.afterDir !== undefined) continue;
    move(m.from, m.to);
  }
  for (const m of plan.moves) {
    if (m.afterDir === undefined) continue;
    move(m.from, m.to); // フォルダを動かした後の置き場の名前
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
  console.log(`[phase-rename] ${result.mode}`);
  console.log(`移動: ${plan.moves.length} 件`);
  for (const m of plan.moves) console.log(`  ${m.from} → ${m.to}`);
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

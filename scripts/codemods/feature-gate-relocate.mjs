#!/usr/bin/env node
// scripts/codemods/feature-gate-relocate.mjs
// 門番の置き場の移行(feature-gate の S1: src/featureGate/ の新設)。fork のリポのルートで、上流の S1 を取り込んだ後に走らせる。
// 使い方: node scripts/codemods/feature-gate-relocate.mjs [--apply] [--no-generate] [--json]
//   既定は dry-run(計画と止める一覧を出すだけ、何も書かない)。--apply で移動(git mv)・書き換えをし、
//   最後に pnpm extensions:generate を走らせる(--no-generate で省く)。手順: ./README.md「門番の置き場を移す」
//
// 移す物(fork が足した物。上流の分は取り込みで移っている):
// - 規則 src/proxies/featureGateRules/<名前>.ts(x)・<名前>/ → src/featureGate/rules/。型の import
//   `import type { FeatureGateRule } from "../types"`(と "@/proxies/types")を "@/featureGate" に。
//   git の取り込みが新しい置き場へ先に移した規則(旧い import のまま)も import だけ直す
// - 常時実行の例外 scripts/proxies/alwaysOnExceptions/<名前>.mjs → src/featureGate/alwaysOnExceptions/<名前>.ts
//   (export const exception / registry に型 AlwaysOnException を付け、型の import を足す)
// - fork のコード(src・scripts)の import: 照合 proxies/pathPattern.mjs → lib/pathPattern/index.mjs、
//   生成一覧 proxies/extensions/featureGateRules の { featureGateRules } → featureGate/node の { rules as featureGateRules }
// 止める(書き換えない): 印付きの名前(先の移行 fork-name-markers が先)・新しい置き場に同じ単位がある・例外の名前が英数字でない
// (案を付ける)・例外に exception も registry も無い・生成一覧の import が { featureGateRules } の形でない

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyDottedName } from "../../src/lib/forkOwnership/dottedNames.mjs";

const OLD_RULES = "src/proxies/featureGateRules";
const NEW_RULES = "src/featureGate/rules";
const OLD_ALWAYS_ON = "scripts/proxies/alwaysOnExceptions";
const NEW_ALWAYS_ON = "src/featureGate/alwaysOnExceptions";
const MARKER_NOTICE = ".notices/20261103-095341-fork-name-markers-removed.md(node scripts/codemods/fork-name-markers.mjs)";
const ITEM_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage"]);

const RULE_TYPE_IMPORT = /import\s+type\s*\{\s*FeatureGateRule\s*\}\s*from\s*["'](?:\.\.\/types|@\/proxies\/types)["'];?/;
// import の指定子だけを見る(from "…" と import("…")。文字列の字面一般は見ない)
const PATH_PATTERN_SPEC = /(\bfrom\s*|\bimport\(\s*)(["'])((?:@\/|(?:\.\.?\/)+(?:src\/)?)proxies\/pathPattern\.mjs)\2/g;
const GATE_LIST_IMPORT = /import\s*\{\s*([^}]*)\}\s*from\s*(["'])((?:@\/|(?:\.\.?\/)+(?:src\/)?)proxies\/extensions\/featureGateRules(?:\.ts)?)\2;?/g;
const GATE_LIST_ANY = /(?:\bfrom\s*|\bimport\(\s*)["'][^"']*proxies\/extensions\/featureGateRules/;
/** この道具自身(と同じ置き場の道具の fixture)は書き換えない */
const SELF_DIR = "scripts/codemods/";

function listFiles(root, dirs = ["src", "scripts"]) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  for (const dir of dirs) walk(dir);
  return out.sort();
}

const camel = (name) => name.replace(/[^A-Za-z0-9]+([A-Za-z0-9])/g, (_m, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "").replace(/^[^A-Za-z]+/, "");
const unitOf = (name) => name.replace(/\.(tsx?|mjs)$/, "");

/** 規則のファイルの型の import を新しい形に(変化が無ければ null) */
export function rewriteRuleImport(text) {
  if (!RULE_TYPE_IMPORT.test(text)) return null;
  return text.replace(RULE_TYPE_IMPORT, 'import type { FeatureGateRule } from "@/featureGate";');
}

/** 例外の .mjs を .ts に(型を付ける)。{ text } か { problem } */
export function convertAlwaysOn(text) {
  const kinds = ["exception", "registry"].filter((k) => new RegExp(`^export\\s+const\\s+${k}\\b`, "m").test(text));
  if (kinds.length !== 1) return { problem: "export const exception か export const registry のどちらか 1 つを書く" };
  const typed = text.replace(new RegExp(`^export\\s+const\\s+${kinds[0]}\\s*=`, "m"), `export const ${kinds[0]}: AlwaysOnException =`);
  const header = /^(?:\s*\/\/[^\n]*\n)*/.exec(typed)[0];
  return { text: `${header}${header ? "\n" : ""}import type { AlwaysOnException } from "@/featureGate";\n\n${typed.slice(header.length).replace(/^\n+/, "")}` };
}

/** 照合の import 先: 別名なら @/lib/pathPattern/index.mjs、相対なら同じ深さの lib/pathPattern/index.mjs */
const pathPatternTarget = (spec) => (spec.startsWith("@/") ? "@/lib/pathPattern/index.mjs" : spec.replace(/proxies\/pathPattern\.mjs$/, "lib/pathPattern/index.mjs"));
const gateListTarget = (spec) => (spec.startsWith("@/") ? "@/featureGate/node" : spec.replace(/proxies\/extensions\/featureGateRules(\.ts)?$/, "featureGate/node.ts"));

/** fork のコードの import 2 種を書き換える。{ text, changed, problem? } */
export function rewriteCodeImports(text) {
  let changed = false;
  let out = text.replace(PATH_PATTERN_SPEC, (_m, lead, q, spec) => {
    changed = true;
    return `${lead}${q}${pathPatternTarget(spec)}${q}`;
  });
  out = out.replace(GATE_LIST_IMPORT, (match, names, q, spec) => {
    const parts = names.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 1 || !/^featureGateRules(\s+as\s+\w+)?$/.test(parts[0])) return match;
    changed = true;
    const local = parts[0].includes(" as ") ? parts[0].split(/\s+as\s+/)[1] : "featureGateRules";
    return `import { rules as ${local} } from ${q}${gateListTarget(spec)}${q};`;
  });
  const problem = GATE_LIST_ANY.test(out) ? "生成一覧 proxies/extensions/featureGateRules を { featureGateRules } 以外の形で読んでいる(手で @/featureGate/node の rules か gate.path に)" : undefined;
  return { text: out, changed, problem };
}

/**
 * 移行の計画(書き換えない)
 * @param {string} root fork のリポのルート
 * @returns {{ moves: { from: string, to: string, kind: string }[], edits: { path: string, kind: string }[], stops: { path: string, reason: string, suggest?: string }[], notes: string[] }}
 */
export function planRelocate(root) {
  const files = listFiles(root);
  const present = new Set(files);
  const newUnits = new Set(files.filter((p) => p.startsWith(`${NEW_RULES}/`)).map((p) => unitOf(p.slice(NEW_RULES.length + 1).split("/")[0])));
  const moves = [];
  const edits = [];
  const stops = [];
  const notes = [];

  // 1. 規則(旧い置き場の直下のファイルとフォルダ形)
  const oldRuleEntries = existsSync(join(root, OLD_RULES)) ? readdirSync(join(root, OLD_RULES), { withFileTypes: true }) : [];
  for (const entry of oldRuleEntries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const from = `${OLD_RULES}/${entry.name}`;
    const shape = classifyDottedName(entry.name, { folder: entry.isDirectory() });
    if (shape.kind === "marker") {
      stops.push({ path: from, reason: `fork の名前の印が残っている。先に ${MARKER_NOTICE} で印を外す` });
      continue;
    }
    const unit = unitOf(entry.name);
    if (newUnits.has(unit)) {
      stops.push({ path: from, reason: `${NEW_RULES}/ に同じ名前の規則がある(上流の規則と同名)`, suggest: `${OLD_RULES}/${unit}Fork${entry.isDirectory() ? "" : entry.name.slice(unit.length)}` });
      continue;
    }
    moves.push({ from, to: `${NEW_RULES}/${entry.name}`, kind: "rule" });
  }
  // 規則の型の import(移す物と、取り込みで先に新しい置き場へ来た物)
  for (const path of files) {
    const inOld = path.startsWith(`${OLD_RULES}/`);
    const inNew = path.startsWith(`${NEW_RULES}/`);
    if (!(inOld || inNew) || !CODE.test(path)) continue;
    if (inOld && !moves.some((m) => path === m.from || path.startsWith(`${m.from}/`))) continue;
    if (rewriteRuleImport(readFileSync(join(root, path), "utf8")) !== null) edits.push({ path, kind: "rule-import" });
  }

  // 2. 常時実行の例外
  for (const path of files.filter((p) => posix.dirname(p) === "scripts/proxies" && /^alwaysOnExceptions\..+\.mjs$/.test(posix.basename(p)))) {
    stops.push({ path, reason: `旧い 1 ファイルの例外表。先に ${MARKER_NOTICE} で行ごとのファイルに分ける` });
  }
  for (const path of files.filter((p) => posix.dirname(p) === OLD_ALWAYS_ON)) {
    const name = posix.basename(path);
    if (!name.endsWith(".mjs")) {
      stops.push({ path, reason: "例外の項目は <名前>.mjs だけ(手で移す)" });
      continue;
    }
    const stem = name.slice(0, -".mjs".length);
    if (classifyDottedName(name).kind === "marker") {
      stops.push({ path, reason: `fork の名前の印が残っている。先に ${MARKER_NOTICE} で印を外す` });
      continue;
    }
    if (!ITEM_NAME.test(stem)) {
      stops.push({ path, reason: "門番の受け口の項目名は英字始まりの英数字だけ(ハイフン不可)", suggest: `${OLD_ALWAYS_ON}/${camel(stem)}.mjs` });
      continue;
    }
    const to = `${NEW_ALWAYS_ON}/${stem}.ts`;
    if (present.has(to)) {
      stops.push({ path, reason: `${to} が既にある` });
      continue;
    }
    const converted = convertAlwaysOn(readFileSync(join(root, path), "utf8"));
    if (converted.problem) {
      stops.push({ path, reason: converted.problem });
      continue;
    }
    moves.push({ from: path, to, kind: "alwaysOn" });
  }

  // 3. fork のコードの import(門番の中と移す規則は除く)
  for (const path of files.filter((p) => CODE.test(p) && !p.startsWith("src/featureGate/") && !p.startsWith(SELF_DIR) && !p.startsWith(`${OLD_RULES}/`) && !p.startsWith(`${OLD_ALWAYS_ON}/`))) {
    const text = readFileSync(join(root, path), "utf8");
    if (!PATH_PATTERN_SPEC.test(text) && !GATE_LIST_ANY.test(text)) continue;
    PATH_PATTERN_SPEC.lastIndex = 0;
    const result = rewriteCodeImports(text);
    if (result.problem) stops.push({ path, reason: result.problem });
    if (!result.changed) continue;
    edits.push({ path, kind: "code-import" });
    if (GATE_LIST_ANY.test(text) && !path.startsWith("scripts/") && !/\.test\.[cm]?[jt]sx?$/.test(path)) {
      notes.push(`${path}: 規則の一覧を読んでいる。@/featureGate/node は scripts とテストだけ(lint feature-gate-entries)→ gate.path / gate.enabled(@/featureGate)に直す`);
    }
  }
  return { moves, edits, stops, notes };
}

/** 計画を当てる(止めた物は触らない) */
export function applyRelocate(root, plan) {
  const tracked = (path) => spawnSync("git", ["ls-files", "--error-unmatch", path], { cwd: root, stdio: "ignore" }).status === 0;
  const movedTo = (path) => {
    const move = plan.moves.find((m) => path === m.from || path.startsWith(`${m.from}/`));
    return move ? move.to + path.slice(move.from.length) : path;
  };
  // 1. 中身の書き換え(移す前の場所で)
  for (const edit of plan.edits) {
    const abs = join(root, edit.path);
    const text = readFileSync(abs, "utf8");
    writeFileSync(abs, edit.kind === "rule-import" ? rewriteRuleImport(text) : rewriteCodeImports(text).text);
  }
  // 2. 移動(規則は git mv、例外は .mjs → .ts の書き換えつき)
  for (const move of plan.moves) {
    mkdirSync(join(root, posix.dirname(move.to)), { recursive: true });
    if (move.kind === "alwaysOn") {
      const converted = convertAlwaysOn(readFileSync(join(root, move.from), "utf8"));
      if (tracked(move.from)) execFileSync("git", ["mv", move.from, move.to], { cwd: root, stdio: "ignore" });
      else renameSync(join(root, move.from), join(root, move.to));
      writeFileSync(join(root, move.to), converted.text);
    } else if (tracked(move.from)) {
      execFileSync("git", ["mv", move.from, move.to], { cwd: root, stdio: "ignore" });
    } else {
      renameSync(join(root, move.from), join(root, move.to));
    }
  }
  // 空になった旧い置き場を消す
  for (const dir of [OLD_RULES, OLD_ALWAYS_ON]) {
    const abs = join(root, dir);
    if (existsSync(abs) && readdirSync(abs).length === 0) rmSync(abs, { recursive: true });
  }
  return { moved: plan.moves.map((m) => m.to), edited: plan.edits.map((e) => movedTo(e.path)) };
}

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const plan = planRelocate(root);
  const result = { mode: apply ? "apply" : "dry-run", ...plan };
  if (apply) {
    Object.assign(result, applyRelocate(root, plan));
    if (!args.includes("--no-generate")) {
      const generated = spawnSync("pnpm", ["extensions:generate"], { cwd: root, encoding: "utf8" });
      result.generate = { status: generated.status, output: `${generated.stdout ?? ""}${generated.stderr ?? ""}`.trim().split("\n").slice(-8).join("\n") };
    }
  }
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[feature-gate-relocate] ${result.mode}`);
    console.log(`移動: ${plan.moves.length} 件`);
    for (const m of plan.moves) console.log(`  ${m.from} → ${m.to}  [${m.kind}]`);
    console.log(`書き換え: ${plan.edits.length} 件`);
    for (const e of plan.edits) console.log(`  ${e.path}  [${e.kind}]`);
    console.log(`止めた物(書き換えない): ${plan.stops.length} 件`);
    for (const s of plan.stops) console.log(`  ${s.path}: ${s.reason}${s.suggest ? ` → 案: ${s.suggest} に改名してからもう一度` : ""}`);
    for (const n of plan.notes) console.log(`手で直す: ${n}`);
    if (result.generate) console.log(`pnpm extensions:generate: exit ${result.generate.status}\n${result.generate.output}`);
    if (apply) console.log("次: pnpm typecheck・pnpm ownership:check・pnpm test:feature-gate");
  }
  if (apply && result.generate && result.generate.status !== 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

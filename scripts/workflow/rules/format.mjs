// scripts/workflow/rules/format.mjs — pnpm check rules の書式の検査: 札・README・対応表 existing_parts の入口
// 止める: 上流の札の書式と札 → 品目の実在、対応表の入口の実在、決まりのファイル(.claude/rules の下の全部、fork の自前の物も)の paths の入れ子の波かっこ。fork が自分で足した札の書式は知らせだけ。
// 数の 1 行の知らせだけ(最後の切り替えで止めるに替える): Tier1 の品目 → 札の実在、README の書式。一覧は --items / --readme。
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { cardId, cardProblems, existingPartRefs, h2Of, readmeProblems } from "./lib.ruleFormat.mjs";
import { CORE_DIR, ITEMS_DIR, listItems, mdUnder, upstreamReader } from "./lib.ruleRepo.mjs";
import { nestedBrace, parsePaths } from "./lib.rulePaths.mjs";

const root = join(import.meta.dirname, "../../..");
const read = (p) => readFileSync(join(root, p), "utf8");
const fails = [];
const notifies = [];
const notes = [];

const { isTier1, upstreamOf, note } = upstreamReader(root);
if (note) notes.push(note);
const items = listItems(root);
const folderOf = (category, name) => items.find((it) => it.category === category && it.name === name)?.folder ?? null;
const readmeH2 = (file) => (existsSync(join(root, file)) ? h2Of(read(file)) : null);

// 札
const cards = mdUnder(root, ITEMS_DIR);
for (const path of cards) {
  const id = cardId(path);
  const problems = cardProblems({ path, text: read(path), itemFolder: id ? folderOf(id.category, id.name) : null, readmeH2 });
  for (const p of problems) (upstreamOf(path) ? fails : notifies).push(`${path}: ${p}`);
}

// Tier1 の品目 → 札(Tier1 のリポでだけ数える。README のある品目が対象)
if (isTier1) {
  const missing = items.filter((it) => it.tier1 && it.hasReadme && !cards.includes(`${ITEMS_DIR}/${it.category}/${it.name}.md`));
  if (missing.length) notifies.push(`札の無い Tier1 の品目 ${missing.length} 個(README のある物、最後の切り替えで止める。一覧: node scripts/workflow/rules/format.mjs --items)`);
  if (process.argv.includes("--items")) for (const it of missing) console.log(`${it.category}/${it.name}\t${it.folder}`);
}

// README(上流の物。fork の自分の README は書式を知らせない: 本文の言語と同じく各リポの物)
const readmes = execFileSync("git", ["ls-files", "--", ":(glob)**/README*.md"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !f.startsWith("node_modules/") && upstreamOf(f));
const badReadmes = readmes.map((f) => ({ f, problems: readmeProblems(read(f)) })).filter((r) => r.problems.length);
if (badReadmes.length) notifies.push(`README の書式に合わない物 ${badReadmes.length} / ${readmes.length} 本(最後の切り替えで止める。一覧: node scripts/workflow/rules/format.mjs --readme)`);
if (process.argv.includes("--readme")) for (const r of badReadmes) console.log(`${r.f}\t${r.problems.join(" / ")}`);

// 対応表 existing_parts の入口の実在
const componentsMd = `${CORE_DIR}/components.md`;
const refs = existsSync(join(root, componentsMd)) ? existingPartRefs(read(componentsMd)) : [];
for (const r of refs) {
  const target = r.kind === "lib" ? `src/lib/${r.ref}` : `src/components/${r.ref}`;
  const exists = existsSync(join(root, target)) || existsSync(join(root, `${target}.tsx`)) || existsSync(join(root, `${target}.ts`));
  if (!exists || (r.kind === "lib" && !statSync(join(root, target)).isDirectory())) fails.push(`${componentsMd}:${r.line}: existing_parts の ${r.ref} が無い(${target})`);
}

// paths の入れ子の波かっこ: Claude Code は当てず読み込まれない(検査の照合は当てるので他の検査では分からない)。どの段の物でも壊れているので止める
const ruleMds = mdUnder(root, ".claude/rules");
for (const path of ruleMds) {
  for (const glob of parsePaths(read(path)) ?? []) {
    if (nestedBrace(glob)) fails.push(`${path} の paths "${glob}" は入れ子の波かっこ(Claude Code は当てない)→ 1 段の波かっこか別の行に開く`);
  }
}

console.log(`rules format: 札 ${cards.length} 枚、対応表の入口 ${refs.length} 個、README ${readmes.length} 本`);
for (const n of notes) console.error(`note: ${n}`);
for (const n of notifies) console.error(`知らせ: ${n}`);
for (const f of fails) console.error(`失敗: ${f}`);
process.exitCode = fails.length ? 1 : 0;

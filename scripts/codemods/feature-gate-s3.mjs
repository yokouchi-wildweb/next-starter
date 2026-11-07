// scripts/codemods/feature-gate-s3.mjs
// 門番の区切り gate-s3 の fork の移行(L1.13・L1.14)。fork のリポのルートで走らせる。何度走らせても同じ結果になる。
//
//   npx tsx --import ./scripts/test/serverOnlyStub.mjs scripts/codemods/feature-gate-s3.mjs            # dry-run(既定)
//   npx tsx --import ./scripts/test/serverOnlyStub.mjs scripts/codemods/feature-gate-s3.mjs --apply    # 書く → pnpm extensions:generate
//   --no-generate(最後の extensions:generate を省く) | --json(機械向けの出力)
//
// 1. 依存の検査(gate-s3 から fork でも落ちる)の違反のうち、規則が今開いている(fork の config の今の値で rule.enabled())物は
//    src/featureGate/required/<規則>.ts を書き出す(この fork が必ず使う機能 = 依存を書いたとみなす)。reason は「codemod が書いた・要見直し」
//    今閉じている規則の違反は書かない(閉じた機能を確かめずに読んでいる = 本当の閉じ漏れ): 一覧に出すので手で直す
//    上流の縮む表(checks/dependencyDebt.mjs。上流は 0 行になって消した)の行と例外は数えない。表の無い版でも同じ結果
//    (表の行だった違反は上流の requires・gate で通るので、どちらの版でも fork の違反だけが残る)。既にある required/ は触らない
// 2. cron の route.ts(src/app/api/cron/<名>/route.ts)の `@/lib/cron` からの createCronTaskRoute の値 import を `@/wiring/cronRoute` へ
//    (lint import-boundaries/cron-route-via-wiring)。createCronRoute(手書きの handler)は wiring に口が無いので止めて一覧に出す
// 手順: 上流を取り込む → dry-run → 閉じた機能の違反と止めた物を片付ける → --apply → typecheck・ownership:check・test:feature-gate → コミット

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

export const REQUIRED_DIR = "src/featureGate/required";
const CRON_DIR = "src/app/api/cron";
const CRON_ROUTE_NAMES = ["createCronTaskRoute"];
const MANUAL_CRON_NAMES = ["createCronRoute"];

/** required/<名前>.ts の本文 */
export function requiredContent(name, count) {
  return `// ${REQUIRED_DIR}/${name}.ts
// この fork が必ず使う機能(codemod feature-gate-s3 が書いた。依存の検査の違反 ${count} 件の時点で開いていた機能)。
// 本当に必須か見直す: 必須なら reason を書き直す / 閉じうるなら消して、読む側を requires・gate.enabled("${name}") で確かめる

import type { RequiredFeature } from "@/featureGate";

export const required: RequiredFeature = {
  reason: "codemod feature-gate-s3 が書いた(依存 ${count} 件、要見直し)",
};
`;
}

/**
 * required/ を書く計画(純関数)
 * @param {{ file: string, folder: string, rule: string }[]} violations 依存の検査の違反(縮む表・例外を除いた物)
 * @param {{ name: string, enabled: () => boolean }[]} rules
 * @param {string[]} existingRequired 既にある required/ の名前
 */
export function planRequired(violations, rules, existingRequired) {
  const byRule = new Map();
  for (const v of violations) byRule.set(v.rule, [...(byRule.get(v.rule) ?? []), v]);
  const write = [];
  const closed = [];
  const kept = [];
  for (const rule of rules) {
    const list = byRule.get(rule.name);
    if (!list) continue;
    if (existingRequired.includes(rule.name)) kept.push(rule.name);
    else if (rule.enabled()) write.push({ name: rule.name, count: list.length, path: `${REQUIRED_DIR}/${rule.name}.ts` });
    else closed.push(...list.map((v) => ({ ...v })));
  }
  return { write, closed, kept };
}

const IMPORT_FROM_CRON = /^import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/cron["'];?[ \t]*$/m;
const IMPORT_FROM_WIRING = /^import\s*\{([^}]*)\}\s*from\s*["']@\/wiring\/cronRoute["'];?[ \t]*$/m;

const splitNames = (clause) => clause.split(",").map((p) => p.trim()).filter(Boolean);
const baseName = (spec) => spec.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();

/**
 * cron の route.ts の import を付け替える(純関数)
 * @returns {{ text: string, changed: boolean, manual: string[] }} manual = 書き換えずに残した手で直す名前
 */
export function rewriteCronRouteImport(text) {
  const match = IMPORT_FROM_CRON.exec(text);
  if (!match) return { text, changed: false, manual: [] };
  const specs = splitNames(match[1]);
  const moving = specs.filter((s) => !s.startsWith("type ") && CRON_ROUTE_NAMES.includes(baseName(s)));
  const manual = specs.filter((s) => !s.startsWith("type ") && MANUAL_CRON_NAMES.includes(baseName(s))).map(baseName);
  if (moving.length === 0) return { text, changed: false, manual };
  const staying = specs.filter((s) => !moving.includes(s));
  const keep = staying.length > 0 ? `import { ${staying.join(", ")} } from "@/lib/cron";` : null;
  const wiring = IMPORT_FROM_WIRING.exec(text);
  let out;
  if (wiring) {
    // 既に @/wiring/cronRoute の import がある: そこへ足し、@/lib/cron の行は残りの名前だけ(無ければ消す)
    const merged = [...new Set([...splitNames(wiring[1]), ...moving])];
    out = text.replace(wiring[0], `import { ${merged.join(", ")} } from "@/wiring/cronRoute";`);
    out = keep ? out.replace(match[0], keep) : out.replace(new RegExp(`${match[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`), "");
  } else {
    const line = `import { ${moving.join(", ")} } from "@/wiring/cronRoute";`;
    out = text.replace(match[0], keep ? `${keep}\n${line}` : line);
  }
  out = out.replace(/\n{3,}/g, "\n\n");
  return { text: out, changed: out !== text, manual };
}

function cronRouteFiles(root) {
  const dir = join(root, CRON_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => `${CRON_DIR}/${name}/route.ts`)
    .filter((rel) => existsSync(join(root, rel)));
}

/** 上流の縮む表の module(古い版だけにある。無い版 = null) */
export const DEBT_MODULE = "src/featureGate/checks/dependencyDebt.mjs";

/**
 * 依存の走査の結果から、required/ の計画に回す違反を選ぶ(純関数)。debt = 縮む表の module(無い版は null)。
 * 例外と許された形は走査の側(scanDependencies)が allowedBy に付ける。ここで落とすのは「許されていない」かつ「縮む表の行でない」物
 */
export function selectViolations(dependencies, debt) {
  const rows = debt?.UPSTREAM_DEPENDENCY_DEBT ?? {};
  return dependencies
    .filter((d) => d.allowedBy === null)
    .filter((d) => !(`${d.file} → ${d.folder}` in rows));
}

/** 例外のファイル(縮む表の module の上流の例外 + fork の受け口) */
export function exceptionFilesOf(debt, forkExceptions) {
  return [...Object.keys(debt?.UPSTREAM_DEPENDENCY_EXCEPTIONS ?? {}), ...forkExceptions.map((e) => e.file)];
}

/** repo を読んで計画を立てる(書かない)。門番の道具は tsx で読む */
export async function planS3(root) {
  const node = await import(join(root, "src/featureGate/node.ts"));
  const { scanDependencies } = await import(join(root, "src/featureGate/checks/dependencies.mjs"));
  const debtPath = join(root, DEBT_MODULE);
  const debtModule = existsSync(debtPath) ? await import(debtPath) : null;
  const exceptionFiles = exceptionFilesOf(debtModule, node.dependencyExceptions);
  const existingRequired = Object.keys(await node.readRequired(root));
  // 規則の値だけの一覧(fork の config の今の値。全開スイッチは通さない、L2.3)。configRules の無い旧い門番は rules
  const gateRules = node.configRules ?? node.rules;
  const violations = selectViolations(scanDependencies({ root, rules: gateRules, exceptionFiles, requiredNames: [] }), debtModule);
  const required = planRequired(violations, gateRules, existingRequired);
  const cron = [];
  const manual = [];
  for (const rel of cronRouteFiles(root)) {
    const result = rewriteCronRouteImport(readFileSync(join(root, rel), "utf8"));
    if (result.changed) cron.push({ path: rel, text: result.text });
    for (const name of result.manual) manual.push(`${rel}: ${name} は @/wiring/cronRoute に口が無い(createCronTaskRoute + task.ts に直す)`);
  }
  return { required, cron, manual };
}

export function applyS3(root, plan) {
  for (const item of plan.required.write) {
    const path = join(root, item.path);
    if (existsSync(path)) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, requiredContent(item.name, item.count));
  }
  for (const item of plan.cron) writeFileSync(join(root, item.path), item.text);
}

function report(plan) {
  const lines = [];
  lines.push(`required/ に書く(今開いている機能の違反): ${plan.required.write.length}`);
  for (const w of plan.required.write) lines.push(`  ${w.path}(違反 ${w.count})`);
  if (plan.required.kept.length > 0) lines.push(`既にある required/(触らない): ${plan.required.kept.join(", ")}`);
  lines.push(`閉じた機能を確かめずに読んでいる(手で直す): ${plan.required.closed.length}`);
  for (const v of plan.required.closed) lines.push(`  ${v.file} → ${v.folder}(規則 ${v.rule})`);
  lines.push(`cron の route.ts の付け替え: ${plan.cron.length}`);
  for (const c of plan.cron) lines.push(`  ${c.path}`);
  lines.push(`止めた物(手で直す): ${plan.manual.length}`);
  for (const m of plan.manual) lines.push(`  ${m}`);
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const plan = await planS3(root);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ required: plan.required, cron: plan.cron.map((c) => c.path), manual: plan.manual }, null, 2));
  } else {
    console.log(report(plan));
  }
  if (!args.includes("--apply")) {
    if (!args.includes("--json")) console.log("\n(dry-run。書くには --apply)");
    return;
  }
  applyS3(root, plan);
  if (!args.includes("--no-generate")) {
    const result = spawnSync("pnpm", ["extensions:generate"], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  if (plan.required.closed.length > 0 || plan.manual.length > 0) {
    console.log("\n手で直す物が残っている(上の一覧)。直してから pnpm test:feature-gate");
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

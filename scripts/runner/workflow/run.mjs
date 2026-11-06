// scripts/runner/workflow/run.mjs — 開発の進め方の道具の入口(pnpm workflow)
// 実行: pnpm workflow [<対象> [<動作> [<引数>...]]]
//   <対象> = scripts/workflow/<対象>/(fork が直下に足したフォルダも同じ規則)、<動作> = そのフォルダの直下の <動作>.{mjs,js,ts}。
//   動作にならない物: *.test.* と lib.*(部品の置き場。動作の間で共有する物はここへ)。
//   .ts は tsx、.mjs / .js は node で起動し、残りの引数はそのまま渡す。終了コードは動作のものを返す。
//   対象・動作を省くと一覧を出す(exit 0)。知らない対象・動作は止める(exit 2)。
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTS = [".mjs", ".js", ".ts"];

const scriptFiles = (dir) =>
  readdirSync(dir).filter((f) => EXTS.includes(extname(f)) && !/\.test\./.test(f) && statSync(join(dir, f)).isFile());

/** 対象 1 つの動作: [{ name, file }](名前順) */
export function actionsOf(dir) {
  return scriptFiles(dir)
    .filter((f) => !/^lib\b/.test(f))
    .map((f) => ({ name: f.slice(0, -extname(f).length), file: f }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 対象の一覧: [{ name, dir, actions }](名前順。動作の無いフォルダも出す) */
export function listTargets(workflowDir) {
  if (!existsSync(workflowDir)) return [];
  return readdirSync(workflowDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: join(workflowDir, e.name), actions: actionsOf(join(workflowDir, e.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const defaultSpawn = (cmd, args, repo) => spawnSync(cmd, args, { cwd: repo, stdio: "inherit" }).status ?? 1;

/** 本体: 終了コードを返す(テストは repo・workflowDir・log・spawn を渡す) */
export function run(argv, { repo = join(HERE, "../../.."), workflowDir = join(repo, "scripts/workflow"), log = console.log, spawn = defaultSpawn } = {}) {
  const [targetName, actionName, ...rest] = argv[0] === "--" ? argv.slice(1) : argv;
  const targets = listTargets(workflowDir);
  const line = (t) => `  ${t.name}: ${t.actions.map((a) => a.name).join(" ") || "(動作なし)"}`;
  if (!targetName) {
    log(["usage: pnpm workflow <対象> <動作> [<引数>...]", ...targets.map(line)].join("\n"));
    return 0;
  }
  const target = targets.find((t) => t.name === targetName);
  if (!target) {
    log(`workflow: 対象 ${targetName} が無い(対象: ${targets.map((t) => t.name).join(", ") || "なし"})`);
    return 2;
  }
  if (!actionName) {
    log([`usage: pnpm workflow ${target.name} <動作> [<引数>...]`, line(target)].join("\n"));
    return 0;
  }
  const action = target.actions.find((a) => a.name === actionName);
  if (!action) {
    log(`workflow: ${target.name} に動作 ${actionName} が無い(動作: ${target.actions.map((a) => a.name).join(", ") || "なし"})`);
    return 2;
  }
  const file = join(target.dir, action.file);
  return extname(file) === ".ts" ? spawn("npx", ["tsx", file, ...rest], repo) : spawn(process.execPath, [file, ...rest], repo);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(run(process.argv.slice(2)));

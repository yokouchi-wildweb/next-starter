// scripts/runner/entries/run.mjs — 道具の入口(pnpm workflow = 開発の進め方の道具 / pnpm ops = 手で使う操作・閲覧の道具)
// 実行: node scripts/runner/entries/run.mjs <workflow|operations> [<対象> [<動作> [<引数>...]]]
//   <対象> = scripts/<種類>/<対象>/(fork が直下に足したフォルダも同じ規則)、<動作> = そのフォルダの直下の <動作>.{mjs,js,ts}。
//   動作にならない物: *.test.* と lib.*、そのフォルダの gate.json が名指す門の入口(pnpm check / generate で呼ぶ)、下のフォルダの中(部品の置き場。動作の間で共有する物はここへ)。
//   .ts は tsx + server-only の下駄、.mjs / .js は node で起動し、残りの引数はそのまま渡す。終了コードは動作のものを返す。
//   対象・動作を省くと一覧を出す(exit 0)。知らない種類・対象・動作は止める(exit 2)。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTS = [".mjs", ".js", ".ts"];
/** 種類 → pnpm のコマンド名 */
export const KINDS = { workflow: "workflow", operations: "ops" };

/** そのフォルダの gate.json が門の入口として名指すファイル(check / generate)。動作には数えない(pnpm check / generate で呼ぶ) */
export function gateEntriesOf(dir) {
  const file = join(dir, "gate.json");
  if (!existsSync(file)) return [];
  try {
    const decl = JSON.parse(readFileSync(file, "utf8"));
    return [decl.check, decl.generate].filter((v) => typeof v === "string");
  } catch {
    return [];
  }
}

/** 対象 1 つの動作: [{ name, file }](名前順) */
export function actionsOf(dir) {
  const gateEntries = gateEntriesOf(dir);
  return readdirSync(dir)
    .filter((f) => EXTS.includes(extname(f)) && !/\.test\./.test(f) && !/^lib\b/.test(f) && !gateEntries.includes(f) && statSync(join(dir, f)).isFile())
    .map((f) => ({ name: f.slice(0, -extname(f).length), file: f }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 対象の一覧: [{ name, dir, actions }](名前順。動作の無いフォルダも出す) */
export function listTargets(kindDir) {
  if (!existsSync(kindDir)) return [];
  return readdirSync(kindDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: join(kindDir, e.name), actions: actionsOf(join(kindDir, e.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const defaultSpawn = (cmd, args, repo) => spawnSync(cmd, args, { cwd: repo, stdio: "inherit" }).status ?? 1;

/** 本体: 終了コードを返す(テストは repo・log・spawn を渡す) */
export function run(argv, { repo = join(HERE, "../../.."), log = console.log, spawn = defaultSpawn } = {}) {
  const [kind, ...restArgv] = argv;
  if (!(kind in KINDS)) {
    log(`entries: 種類 ${kind ?? "(なし)"} は知らない(${Object.keys(KINDS).join(" / ")})`);
    return 2;
  }
  const cmd = `pnpm ${KINDS[kind]}`;
  const [targetName, actionName, ...rest] = restArgv[0] === "--" ? restArgv.slice(1) : restArgv;
  const targets = listTargets(join(repo, "scripts", kind));
  const line = (t) => `  ${t.name}: ${t.actions.map((a) => a.name).join(" ") || "(動作なし)"}`;
  if (!targetName) {
    log([`usage: ${cmd} <対象> <動作> [<引数>...]`, ...targets.map(line)].join("\n"));
    return 0;
  }
  const target = targets.find((t) => t.name === targetName);
  if (!target) {
    log(`${KINDS[kind]}: 対象 ${targetName} が無い(対象: ${targets.map((t) => t.name).join(", ") || "なし"})`);
    return 2;
  }
  if (!actionName) {
    log([`usage: ${cmd} ${target.name} <動作> [<引数>...]`, line(target)].join("\n"));
    return 0;
  }
  const action = target.actions.find((a) => a.name === actionName);
  if (!action) {
    log(`${KINDS[kind]}: ${target.name} に動作 ${actionName} が無い(動作: ${target.actions.map((a) => a.name).join(", ") || "なし"})`);
    return 2;
  }
  const file = join(target.dir, action.file);
  if (extname(file) === ".ts") return spawn("npx", ["tsx", "--import", "./scripts/runner/preload/serverOnly.mjs", file, ...rest], repo);
  return spawn(process.execPath, [file, ...rest], repo);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(run(process.argv.slice(2)));

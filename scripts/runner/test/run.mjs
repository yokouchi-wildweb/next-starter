// scripts/runner/test/run.mjs — テストの入口(pnpm test)
// 実行: pnpm test [<パス | glob>...] [--group=unit|fork|db] [--db] [--changed] [--list]
//   走査: git の追跡 + 未追跡のテストのファイル(scan.mjs、tests/e2e/・*.types.test.* は除く。servers/ は名指しの時だけ)を毎回。
//   群: 既定 = unit + fork、--db で db も、--group=<群>[,<群>] でその群だけ。引数のパス・glob(リポジトリ直下から)で絞る。
//   --changed: 範囲(門の watch と同じ比べ方)の変更から選ぶ(changed.mjs)。辿れなかったテストは名前を出す。
//   --list: 選んだファイルを出すだけ(起動しない)。
//   起動: npx tsx --import ./scripts/runner/preload/serverOnly.mjs --experimental-test-module-mocks [// test-flags:] --test <files>
//   (node --test と同じく 1 ファイル 1 プロセス)。db の群は env APP_ENV=.env.development(未設定なら)。
//   exit 0 = 全部通る(0 本も含む)| 1 = 落ちた | 2 = 引数・フラグの誤り
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, globToRegExp } from "../gates/changed.mjs";
import { scanTree, selectChanged } from "./changed.mjs";
import { GROUPS, NAMED_ONLY, groupOf, listTestFiles, readFlags } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE_ARGS = ["tsx", "--import", "./scripts/runner/preload/serverOnly.mjs", "--experimental-test-module-mocks"];

export function parseArgs(argv) {
  const opts = { groups: null, db: false, changed: false, list: false, patterns: [] };
  for (const a of argv.filter((x) => x !== "--")) {
    if (a === "--db") opts.db = true;
    else if (a === "--changed") opts.changed = true;
    else if (a === "--list") opts.list = true;
    else if (a.startsWith("--group=")) opts.groups = a.slice(8).split(",").filter(Boolean);
    else if (a.startsWith("--")) return { problem: `知らない引数 ${a}(pnpm test [<パス | glob>...] [--group=unit|fork|db] [--db] [--changed] [--list])` };
    else opts.patterns.push(a);
  }
  const bad = (opts.groups ?? []).filter((g) => !GROUPS.includes(g));
  if (bad.length) return { problem: `知らない群 ${bad.join(", ")}(群: ${GROUPS.join(", ")})` };
  return opts;
}

const matches = (file, pattern) => (/[*?]/.test(pattern) ? globToRegExp(pattern).test(file) : file === pattern || file.startsWith(pattern.replace(/\/?$/, "/")));

/** 選ぶ: { files, notes } か { problem } */
export async function select(opts, { repo, files, changed = changedFiles, tree = scanTree }) {
  const groups = opts.groups ?? (opts.db ? GROUPS : ["unit", "fork"]);
  // servers/ の下は引数のパス・glob がそこを名指しした時だけ(NAMED_ONLY)
  const namedOnly = opts.patterns.some((p) => NAMED_ONLY.test(p));
  const all = (files ?? listTestFiles(repo, { namedOnly })).filter((f) => namedOnly || !NAMED_ONLY.test(f));
  let picked = all.filter((f) => groups.includes(groupOf(f)));
  if (opts.patterns.length) picked = picked.filter((f) => opts.patterns.some((p) => matches(f, p)));
  const notes = [];
  if (opts.changed) {
    const range = changed(repo);
    if (range.files === null) notes.push(`--changed: ${range.why}ので選んだ全部を回す`);
    else {
      const t = range.files.length ? await tree(repo, picked) : {};
      const { selected, untraced } = selectChanged(picked, range.files, t);
      for (const u of untraced) notes.push(`依存を辿れなかった: ${u}(同じフォルダで選んだ)`);
      notes.push(`--changed: 変更 ${range.files.length} ファイル → テスト ${selected.length} 本`);
      picked = selected;
    }
  }
  return { files: picked, notes };
}

const defaultSpawn = (args, env, repo) => spawnSync("npx", args, { cwd: repo, env, stdio: "inherit" }).status ?? 1;

/** 本体: 終了コード(テストは repo・log・spawn・files・changed・tree を渡す) */
export async function run(argv, { repo = join(HERE, "../../.."), log = console.log, spawn = defaultSpawn, ...deps } = {}) {
  const opts = parseArgs(argv);
  if (opts.problem) {
    log(`test: ${opts.problem}`);
    return 2;
  }
  const { files, notes } = await select(opts, { repo, ...deps });
  for (const n of notes) log(`test: ${n}`);
  if (opts.list) {
    for (const f of files) log(`${groupOf(f)}\t${f}`);
    log(`test: ${files.length} 本`);
    return 0;
  }
  if (!files.length) {
    log("test: 選んだテストは 0 本");
    return 0;
  }
  // 同じ群・同じフラグごとに 1 回起動する
  const batches = new Map();
  for (const f of files) {
    const fl = (deps.readFlags ?? readFlags)(repo, f);
    if (fl.problem) {
      log(`test: ${f}: ${fl.problem}`);
      return 2;
    }
    const key = `${groupOf(f) === "db" ? "db" : "-"}|${fl.flags.join(" ")}`;
    if (!batches.has(key)) batches.set(key, { db: groupOf(f) === "db", flags: fl.flags, files: [] });
    batches.get(key).files.push(f);
  }
  let code = 0;
  for (const b of batches.values()) {
    const env = { ...process.env };
    if (b.db && !env.APP_ENV) env.APP_ENV = ".env.development";
    log(`test: ${b.files.length} 本${b.db ? "(db)" : ""}${b.flags.length ? ` ${b.flags.join(" ")}` : ""}`);
    if (spawn([...BASE_ARGS, ...b.flags, "--test", ...b.files], env, repo) !== 0) code = 1;
  }
  return code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await run(process.argv.slice(2)));

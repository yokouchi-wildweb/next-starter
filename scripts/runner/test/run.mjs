// scripts/runner/test/run.mjs — テストの入口(pnpm test)
// 実行: pnpm test [<パス | glob>...] [--group=unit|fork|db] [--db] [--changed] [--list] [--file-timeout=<秒>] [--test-timeout=<秒>]
//   走査: git の追跡 + 未追跡のテストのファイル(scan.mjs、tests/e2e/・*.types.test.* は除く。servers/ は名指しの時だけ)を毎回。
//   群: 既定 = unit + fork、--db で db も、--group=<群>[,<群>] でその群だけ。引数のパス・glob(リポジトリ直下から)で絞る。
//   --changed: 範囲(門の watch と同じ比べ方)の変更から選ぶ(changed.mjs)。辿れなかったテストは名前を出す。
//   servers/ の下のテストは名指しの時と、--changed の範囲に servers/ の下の変更がある時だけ候補にする。
//   門が回すテスト(gate.json の check がテスト・tests の欄)は名指しでない時は回さない(門 1 回、D389。除いた本数を出す)。
//   --list: 選んだファイルを出すだけ(起動しない)。
//   終わり方: ファイルのプロセスは node に任せて自然に終える。接続・タイマーが残って終わらないファイルは 1 ファイルの上限で名前付きで落ちる。
//   --test-force-exit は付けない: 子の報告の終わりが親へ届く前にプロセスを終え、ファイルの後ろのテストが pass にも fail にも数えられず
//   黙って消える(実測: 同じ木で 4156〜4195 本と揺れ、付けなければ毎回 4219 本)。
//   時間の上限: test() 1 つごと 既定 60 秒(node の --test-timeout。--test-timeout=<秒> か env TEST_TIMEOUT、0 = なし)と、
//   1 ファイルごと 既定 120 秒(preload/fileTimeout.mjs が子の中で見張る。--file-timeout=<秒> か env TEST_FILE_TIMEOUT、0 = なし)。
//   起動: node <tsx の cli> --import ./scripts/runner/preload/serverOnly.mjs --import ./scripts/runner/preload/fileTimeout.mjs --experimental-test-module-mocks
//         [--test-timeout=<ms>] [// test-flags:] --test <files>
//   (node --test と同じく 1 ファイル 1 プロセス)。--test の後のファイルは node が glob として読むので、[ ] { } * ? は 1 文字の組 [x] で
//   そのものに戻して渡す(globLiteral。src/app/**/[id]/ の下のテストが 0 本になって黙って通るのを防ぐ)。npx は通さない: npx は
//   コマンドを shell に渡し、shell の glob が [[]id[]] を [id] に戻してしまう(tsx の cli を node で直に起動する)。db の群は env ENV_FILE=.env.development(未設定なら)。門番の全開スイッチ FEATURE_GATE_OPEN は子に渡さない。
//   exit 0 = 全部通る(0 本も含む)| 1 = 落ちた | 2 = 引数・フラグの誤り
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, globToRegExp } from "../gates/changed.mjs";
import { gateTestFiles } from "../gates/scan.mjs";
import { scanTree, selectChanged } from "./changed.mjs";
import { GROUPS, NAMED_ONLY, groupOf, listTestFiles, readFlags } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE_ARGS = [
  "tsx",
  "--import",
  "./scripts/runner/preload/serverOnly.mjs",
  "--import",
  "./scripts/runner/preload/fileTimeout.mjs",
  "--experimental-test-module-mocks",
];
const USAGE = "pnpm test [<パス | glob>...] [--group=unit|fork|db] [--db] [--changed] [--list] [--file-timeout=<秒>] [--test-timeout=<秒>]";
/** test() 1 つの時間の上限の既定(秒) */
export const DEFAULT_TEST_TIMEOUT = 60;
const SECONDS = /^\d+(\.\d+)?$/;

/** test() 1 つの上限 → node の引数(フラグ > env TEST_TIMEOUT > 既定、0 = 付けない)。{ args } か { problem } */
export function testTimeoutArgs(flag, env = process.env) {
  const v = flag ?? (env.TEST_TIMEOUT === undefined || env.TEST_TIMEOUT === "" ? String(DEFAULT_TEST_TIMEOUT) : env.TEST_TIMEOUT);
  if (!SECONDS.test(v)) return { problem: `TEST_TIMEOUT は 0 以上の秒数(0 = 上限なし): ${v}` };
  const ms = Math.round(Number(v) * 1000);
  return { args: ms > 0 ? [`--test-timeout=${ms}`] : [] };
}

export function parseArgs(argv) {
  const opts = { groups: null, db: false, changed: false, list: false, fileTimeout: null, testTimeout: null, patterns: [] };
  for (const a of argv.filter((x) => x !== "--")) {
    if (a === "--db") opts.db = true;
    else if (a === "--changed") opts.changed = true;
    else if (a === "--list") opts.list = true;
    else if (a.startsWith("--group=")) opts.groups = a.slice(8).split(",").filter(Boolean);
    else if (a.startsWith("--file-timeout=")) {
      const v = a.slice(15);
      if (!SECONDS.test(v)) return { problem: `--file-timeout は 0 以上の秒数(0 = 上限なし): ${a}` };
      opts.fileTimeout = v;
    } else if (a.startsWith("--test-timeout=")) {
      const v = a.slice(15);
      if (!SECONDS.test(v)) return { problem: `--test-timeout は 0 以上の秒数(0 = 上限なし): ${a}` };
      opts.testTimeout = v;
    } else if (a.startsWith("--")) return { problem: `知らない引数 ${a}(${USAGE})` };
    else opts.patterns.push(a);
  }
  const bad = (opts.groups ?? []).filter((g) => !GROUPS.includes(g));
  if (bad.length) return { problem: `知らない群 ${bad.join(", ")}(群: ${GROUPS.join(", ")})` };
  return opts;
}

const matches = (file, pattern) => (/[*?]/.test(pattern) ? globToRegExp(pattern).test(file) : file === pattern || file.startsWith(pattern.replace(/\/?$/, "/")));

/** 選ぶ: { files, notes } か { problem } */
export async function select(opts, { repo, files, changed = changedFiles, tree = scanTree, gateTests = gateTestFiles }) {
  const groups = opts.groups ?? (opts.db ? GROUPS : ["unit", "fork"]);
  // servers/ の下は引数のパス・glob がそこを名指しした時と、--changed の範囲に servers/ の下の変更がある時だけ(NAMED_ONLY)
  const range = opts.changed ? changed(repo) : null;
  const namedOnly = opts.patterns.some((p) => NAMED_ONLY.test(p)) || Boolean(range?.files?.some((f) => NAMED_ONLY.test(f)));
  const all = (files ?? listTestFiles(repo, { namedOnly })).filter((f) => namedOnly || !NAMED_ONLY.test(f));
  let picked = all.filter((f) => groups.includes(groupOf(f)));
  const notes = [];
  if (opts.patterns.length) picked = picked.filter((f) => opts.patterns.some((p) => matches(f, p)));
  else {
    // 門の入口のテスト(gate.json の check がテスト・tests の欄)は門 1 回: 名指しでない時は回さない(D389)
    const gated = gateTests(repo);
    const dropped = picked.filter((f) => gated.has(f));
    if (dropped.length) {
      picked = picked.filter((f) => !gated.has(f));
      const by = [...new Set(dropped.map((f) => gated.get(f)))].join("・");
      notes.push(`門が回すテスト ${dropped.length} 本を除いた(${by}。pnpm check が回す。名指しすれば回す)`);
      if (opts.list) for (const f of dropped) notes.push(`除いた: ${f}(門 ${gated.get(f)})`);
    }
  }
  if (opts.changed) {
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

/** node --test の引数は glob: パスの [ ] { } * ? を [x](その 1 文字だけの組)にして、そのファイルだけを指す形にする */
export const globLiteral = (file) => file.replace(/[[\]{}*?]/g, (c) => `[${c}]`);

// args[0] = 起動するもの(tsx)。その cli を node で直に起動する(shell を通さないので、パスの [ ] が shell の glob に読まれない)
const defaultSpawn = ([bin, ...rest], env, repo) => {
  const cli = createRequire(join(repo, "package.json")).resolve(`${bin}/cli`);
  return spawnSync(process.execPath, [cli, ...rest], { cwd: repo, env, stdio: "inherit" }).status ?? 1;
};

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
  const timeout = testTimeoutArgs(opts.testTimeout);
  if (timeout.problem) {
    log(`test: ${timeout.problem}`);
    return 2;
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
    // 門番の全開スイッチは子に渡さない: テストは規則の値か overrideSwitches で開閉を作る(上流の開発の env の FEATURE_GATE_OPEN=all を
    // シェルで export していても答えが揺れない)。スイッチそのものを試すテストは自分で env を置く(scripts/structure/proxies/openSwitch.test.ts の withEnv)
    delete env.FEATURE_GATE_OPEN;
    // ファイルごとの時間の上限(preload/fileTimeout.mjs が読む)。フラグが env より勝つ
    if (opts.fileTimeout !== null) env.TEST_FILE_TIMEOUT = opts.fileTimeout;
    if (b.db && !env.ENV_FILE) env.ENV_FILE = ".env.development";
    log(`test: ${b.files.length} 本${b.db ? "(db)" : ""}${b.flags.length ? ` ${b.flags.join(" ")}` : ""}`);
    if (spawn([...BASE_ARGS, ...timeout.args, ...b.flags, "--test", ...b.files.map(globLiteral)], env, repo) !== 0) code = 1;
  }
  return code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = await run(process.argv.slice(2));

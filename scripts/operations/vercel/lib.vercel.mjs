// scripts/operations/vercel/lib.vercel.mjs — pnpm ops vercel の本体(動作のファイルはここを呼ぶだけ)
//
// Vercel の操作の口(D412)。vercel CLI を呼ぶ:
//   見る: status(リンクしたプロジェクトと最近のデプロイ)・env-ls [<環境>](名前と環境だけ。値は出ない)→ 方針も許可も見ない
//   書く・取る: env-add / env-rm / env-pull。書く 3 動作は .ts で、前半(prepareVercel: 使い方・値・前提)の後に共通の守り
//     guardDeploy(種類 env_production)を呼ぶ(core/scripts.md write_guard)。方針と許可を確かめるのは守りの 1 か所だけ:
//     向き先が本番の時、端末の人には production と打たせ、非対話なら repo.json の agent.env_production が manual で人の
//     /allow evp の 1 回分の許可がある時だけ通して許可を消す(off・許可なしは止める、D420)。development・preview は方針も許可も見ない(D462)。
//     前提(CLI・ログイン・リンク)は守りの前に確かめる: 揃わない時は許可を使わない。--confirm= は引数に書けない(使い方の誤り)
//   本番へ出す操作は入れない(agent.deploy の入口 pnpm live)
// 値: env-add の値は標準入力か --value-file=<道> で受け、vercel にも標準入力で渡す(引数・画面・記録に出さない)。末尾の改行 1 つは外す
//   env-add の本番は、足せた後に同じ値を checkout の .env.production にも書く(同じ名の行は置き換え、無ければ末尾。D462 (1))
// デプロイの前の揃え(syncProductionEnv、pnpm live が本番に出す時に守りの後で呼ぶ、D462 (2)): .env.production の空でない鍵のうち
//   Vercel の本番に無い名を、その値で足す(足すだけ・上書きしない・足した名を画面に。VERCEL_ で始まる名は Vercel のもの)
// 終了コード: 0 = した / 1 = 使い方の誤り・守りが止めた(本番の方針 off・許可なし・確認なし)/ 3 = 前提なし(CLI・ログイン・リンク)/ 5 = vercel が失敗
// 説明: scripts/operations/vercel/README.md

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseEnvFile } from "../../workflow/backend-selection/lib.mjs";
export const ENVIRONMENTS = ["production", "preview", "development"];

/** 動作 → { usage, write } */
export const ACTIONS = {
  status: { usage: "pnpm ops vercel status", write: false },
  "env-ls": { usage: "pnpm ops vercel env-ls [production|preview|development]", write: false },
  "env-add": { usage: "pnpm ops vercel env-add <名前> <production|preview|development> [--value-file=<道>](値は標準入力か --value-file)", write: true },
  "env-rm": { usage: "pnpm ops vercel env-rm <名前> <production|preview|development>", write: true },
  "env-pull": { usage: "pnpm ops vercel env-pull <production|preview|development> <書く先>", write: true },
};

/** 呼んだ所のチェックアウトの直下(git の外なら今の場所) */
export const checkoutRoot = (cwd) => {
  const r = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : cwd;
};

const isEnv = (v) => ENVIRONMENTS.includes(v);
const isName = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);

/**
 * 引数 → { argv(vercel へ), environment, valueFile, needsValue } | null(使い方の誤り)
 * @param {string} action @param {string[]} args
 */
export function planOf(action, args) {
  const opts = args.filter((a) => a.startsWith("--"));
  const pos = args.filter((a) => !a.startsWith("--"));
  const valueFile = opts.find((o) => o.startsWith("--value-file="))?.slice("--value-file=".length);
  const unknown = opts.filter((o) => !(action === "env-add" && o.startsWith("--value-file=")));
  if (unknown.length) return null;
  switch (action) {
    case "status":
      return pos.length === 0 ? { argv: [["project", "inspect"], ["ls"]] } : null;
    case "env-ls":
      if (pos.length > 1 || (pos.length === 1 && !isEnv(pos[0]))) return null;
      return { argv: [["env", "ls", ...pos]] };
    case "env-add":
      if (pos.length !== 2 || !isName(pos[0]) || !isEnv(pos[1]) || valueFile === "") return null;
      return { environment: pos[1], argv: [["env", "add", pos[0], pos[1]]], valueFile, needsValue: true };
    case "env-rm":
      if (pos.length !== 2 || !isName(pos[0]) || !isEnv(pos[1])) return null;
      return { environment: pos[1], argv: [["env", "rm", pos[0], pos[1], "--yes"]] };
    case "env-pull":
      if (pos.length !== 2 || !isEnv(pos[0])) return null;
      return { environment: pos[0], argv: [["env", "pull", pos[1], `--environment=${pos[0]}`, "--yes"]] };
    default:
      return null;
  }
}

/** 値の末尾の改行 1 つを外す */
const trimValue = (s) => s.replace(/\r?\n$/, "");

const readStdin = () => {
  if (process.stdin.isTTY) return null;
  try {
    return readFileSync(0, "utf8");
  } catch {
    return null;
  }
};

/**
 * 前半: 使い方・値・前提(CLI・ログイン・リンク)を確かめる(vercel の見るだけの命令のほか何も呼ばない、許可も読まない)。
 * 本番の方針と許可は書く 3 動作の入口の守り guardDeploy が確かめる。→ { code }(止める)| { prepared }(後半へ。production = 向き先が本番)
 * @param {string} action @param {string[]} args
 */
export async function prepareVercel(action, args, { print = console.log, cwd = process.cwd(), stdin = readStdin, env = process.env } = {}) {
  const spec = ACTIONS[action];
  const plan = spec ? planOf(action, args) : null;
  if (!plan) {
    print(`使い方: ${spec?.usage ?? Object.values(ACTIONS).map((a) => a.usage).join(" | ")}`);
    return { code: 1 };
  }
  const root = checkoutRoot(cwd);
  let value = null;
  if (plan.needsValue) {
    if (plan.valueFile) {
      const file = path.resolve(cwd, plan.valueFile);
      if (!existsSync(file)) {
        print(`vercel: --value-file の ${plan.valueFile} がありません。呼んでいません`);
        return { code: 1 };
      }
      value = trimValue(readFileSync(file, "utf8"));
    } else {
      const s = stdin();
      value = s === null ? null : trimValue(s);
    }
    if (!value) {
      print(`vercel: 値がありません(標準入力か --value-file=<道> で渡す。引数には書かない)。呼んでいません`);
      return { code: 1 };
    }
  }
  const missing = vercelMissing(root, env);
  if (missing) {
    print(`vercel: ${missing}。呼んでいません`);
    return { code: 3 };
  }
  return { prepared: { action, spec, plan, root, value, production: plan.environment === "production" } };
}

/** 前提(CLI・ログイン・リンク)の欠け 1 行 | null(揃っている) */
function vercelMissing(root, env) {
  const run = (argv) => spawnSync("vercel", argv, { cwd: root, env, encoding: "utf8" });
  const version = run(["--version"]);
  if (version.error || version.status !== 0) return "vercel CLI がありません(npm i -g vercel)";
  if (run(["whoami"]).status !== 0) return "Vercel にログインしていません(人が vercel login)";
  if (!existsSync(path.join(root, ".vercel", "project.json"))) return "このチェックアウトは Vercel のプロジェクトにリンクしていません(人が vercel link)";
  return null;
}

/**
 * 後半: vercel を呼ぶ(前提は前半、本番の確認は守りが済ませた後)。終了コードを返す
 * @param {Awaited<ReturnType<typeof prepareVercel>>["prepared"]} prepared
 */
export function executeVercel({ action, spec, plan, root, value, production }, { print = console.log, env = process.env } = {}) {
  const run = (argv, opts = {}) => spawnSync("vercel", argv, { cwd: root, env, encoding: "utf8", ...opts });
  for (const argv of plan.argv) {
    const r = run(argv, value === null ? { stdio: ["ignore", "inherit", "inherit"] } : { input: value, stdio: ["pipe", "inherit", "inherit"] });
    if (r.status !== 0) {
      print(`vercel: vercel ${argv.slice(0, 2).join(" ")} が失敗しました(exit ${r.status ?? "?"})`);
      return 5;
    }
  }
  if (spec.write) print(`vercel: ${plan.argv[0].slice(0, 2).join(" ")} をしました`);
  if (action === "env-add" && production) {
    writeEnvValue(path.join(root, ENV_PRODUCTION), plan.argv[0][2], value);
    print(`vercel: ${ENV_PRODUCTION} にも ${plan.argv[0][2]} を書きました(同じ値)`);
  }
  return 0;
}

/** 本番の値のファイル(checkout の根) */
export const ENV_PRODUCTION = ".env.production";

/** env のファイルの 1 行の値(空白・#・引用符・改行を含む値は引用符で囲む。改行は \n) @param {string} value */
export function envValueText(value) {
  if (value.includes("\n")) return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  if (!/[\s#"'`]/.test(value)) return value;
  return value.includes('"') ? `'${value}'` : `"${value}"`;
}

/**
 * env のファイルに 名前=値 を書く: 同じ名の行(コメントでない、export 付きも)を置き換え、無ければ末尾に足す。ファイルが無ければ作る
 * @param {string} file @param {string} name @param {string} value
 */
export function writeEnvValue(file, name, value) {
  const line = `${name}=${envValueText(value)}`;
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
  const at = lines.findIndex((l) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(l));
  if (at >= 0) lines[at] = line;
  else lines.push(line);
  writeFileSync(file, `${lines.join("\n")}\n`);
}

/** vercel env ls の出力 → 名前(表の行 = 最初の語が名前で、後ろの列に環境の名がある行。見出し・CLI の版の行は数えない) @param {string} text */
export function vercelEnvNames(text) {
  const names = new Set();
  for (const raw of text.split("\n")) {
    const cols = raw.trim().split(/\s+/);
    if (cols.length >= 2 && isName(cols[0]) && cols.slice(1).some((c) => /^(production|preview|development)\b/i.test(c))) names.add(cols[0]);
  }
  return names;
}

/**
 * デプロイの前の揃え(D462 (2)): .env.production の空でない鍵のうち Vercel の本番に無い名をその値で足す。上書き・消しはしない。
 * run(argv, opts) = vercel を呼ぶ関数(spawnSync の形を返す)。戻り { ok, added, why? }(足すのに失敗・名前が読めない = ok: false)
 * @param {{ root: string, run: (argv: string[], opts?: object) => { status: number | null, stdout?: string, stderr?: string }, print?: (s: string) => void }} o
 */
export function syncProductionEnv({ root, run, print = console.log }) {
  const file = path.join(root, ENV_PRODUCTION);
  if (!existsSync(file)) {
    print(`env の揃え: ${ENV_PRODUCTION} が無いので足す物なし`);
    return { ok: true, added: [] };
  }
  const local = [...parseEnvFile(readFileSync(file, "utf8"))].filter(([name, value]) => value !== "" && !name.startsWith("VERCEL_"));
  const ls = run(["env", "ls", "production"], { stdio: ["ignore", "pipe", "pipe"] });
  if (ls.status !== 0) {
    print(`env の揃え: vercel env ls production が失敗しました(exit ${ls.status ?? "?"})`);
    return { ok: false, added: [], why: "env ls" };
  }
  const remote = vercelEnvNames(`${ls.stdout ?? ""}\n${ls.stderr ?? ""}`);
  const missing = local.filter(([name]) => !remote.has(name));
  const added = [];
  for (const [name, value] of missing) {
    const r = run(["env", "add", name, "production"], { input: value, stdio: ["pipe", "inherit", "inherit"] });
    if (r.status !== 0) {
      print(`env の揃え: vercel env add ${name} production が失敗しました(exit ${r.status ?? "?"})。足した名: ${added.join(", ") || "なし"}`);
      return { ok: false, added, why: name };
    }
    added.push(name);
    print(`env の揃え: Vercel の本番に ${name} を ${ENV_PRODUCTION} の値で足しました`);
  }
  if (!added.length) print(`env の揃え: ${ENV_PRODUCTION} の鍵は全部 Vercel の本番にある(足す物なし)`);
  return { ok: true, added };
}

/** 見る動作の入口(status・env-ls: 方針・許可・本番の確認なし) @param {string} action */
export async function main(action) {
  const r = await prepareVercel(action, process.argv.slice(2));
  process.exitCode = "code" in r ? r.code : executeVercel(r.prepared);
}

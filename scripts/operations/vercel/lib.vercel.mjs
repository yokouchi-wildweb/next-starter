// scripts/operations/vercel/lib.vercel.mjs — pnpm ops vercel の本体(動作のファイルはここを呼ぶだけ)
//
// Vercel の操作の口(D412)。vercel CLI を呼ぶ:
//   見る: status(リンクしたプロジェクトと最近のデプロイ)・env-ls [<環境>](名前と環境だけ。値は出ない)→ 方針も許可も見ない
//   書く・取る: env-add / env-rm / env-pull → repo.json の agent.env_production(scripts/workflow/devcheck/lib.kinds.mjs)を読む。
//     off = 打たず人が打つ 1 行(exit 4)/ manual(既定)= 人の /allow evp の 1 回分の許可(.agent/devcheck-allow.json、lib.allow.mjs)がある時だけ。
//     許可は前提(CLI・ログイン・リンク)が揃って呼ぶ直前に使って消える(揃わない時は使わない)。次の人の入力でも消える(devcheck の hook)
//     書く 3 動作は .ts で、前半(prepareVercel)の後に共通の守り guardDeploy(種類 env_production)を呼ぶ(core/scripts.md write_guard)。
//     向き先が本番で非対話なら、守りが方針と evp の許可を読んで通し、その場で許可を消す(D420。後半の許可の消しはその時は何もしない)。
//     端末の人には守りが production と打たせる。--confirm= は引数に書けない(使い方の誤り)
//   本番へ出す操作は入れない(agent.deploy の入口 pnpm live)
// 値: env-add の値は標準入力か --value-file=<道> で受け、vercel にも標準入力で渡す(引数・画面・記録に出さない)。末尾の改行 1 つは外す
// 終了コード: 0 = した / 1 = 使い方の誤り / 2 = 方針が読めない / 3 = 前提なし(CLI・ログイン・リンク)/ 4 = 方針 off・許可なし / 5 = vercel が失敗
// 説明: scripts/operations/vercel/README.md

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { consumePermit, readPermit } from "../../workflow/devcheck/lib.allow.mjs";
import { policyKeyOf, readAgentPolicy, switchOf } from "../../workflow/devcheck/lib.kinds.mjs";

const KIND = "env_production";
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
 * 引数 → { argv(vercel へ), human(人が打つ形), valueFile, stdinValue } | null(使い方の誤り)
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
      return pos.length === 0 ? { argv: [["project", "inspect"], ["ls"]], human: "vercel project inspect && vercel ls" } : null;
    case "env-ls":
      if (pos.length > 1 || (pos.length === 1 && !isEnv(pos[0]))) return null;
      return { argv: [["env", "ls", ...pos]], human: `vercel env ls ${pos.join(" ")}`.trim() };
    case "env-add":
      if (pos.length !== 2 || !isName(pos[0]) || !isEnv(pos[1]) || valueFile === "") return null;
      return { environment: pos[1], argv: [["env", "add", pos[0], pos[1]]], human: `vercel env add ${pos[0]} ${pos[1]}(値はそのタブで打つ)`, valueFile, needsValue: true };
    case "env-rm":
      if (pos.length !== 2 || !isName(pos[0]) || !isEnv(pos[1])) return null;
      return { environment: pos[1], argv: [["env", "rm", pos[0], pos[1], "--yes"]], human: `vercel env rm ${pos[0]} ${pos[1]}` };
    case "env-pull":
      if (pos.length !== 2 || !isEnv(pos[0])) return null;
      return { environment: pos[0], argv: [["env", "pull", pos[1], `--environment=${pos[0]}`, "--yes"]], human: `vercel env pull ${pos[1]} --environment=${pos[0]}` };
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
 * 前半: 使い方・方針・許可・値を確かめる(何も呼ばない、許可も使わない)。
 * → { code }(止める)| { prepared }(後半へ。production = 向き先が本番)
 * @param {string} action @param {string[]} args
 */
export async function prepareVercel(action, args, { print = console.log, cwd = process.cwd(), stdin = readStdin } = {}) {
  const spec = ACTIONS[action];
  const plan = spec ? planOf(action, args) : null;
  if (!plan) {
    print(`使い方: ${spec?.usage ?? Object.values(ACTIONS).map((a) => a.usage).join(" | ")}`);
    return { code: 1 };
  }
  const root = checkoutRoot(cwd);
  const sw = switchOf(KIND);
  const human = `人が打つなら ${plan.human}`;
  if (spec.write) {
    let agent;
    try {
      agent = await readAgentPolicy(root);
    } catch (e) {
      print(`vercel: 方針が読めません(${e instanceof Error ? e.message : String(e)})。呼んでいません。${human}`);
      return { code: 2 };
    }
    if (agent.policy[KIND] !== "manual") {
      print(`vercel: 呼んでいません — ${KIND} は方針で off: ${human}、任せるなら /repo-policy で ${policyKeyOf(KIND)} を manual に`);
      return { code: 4 };
    }
    if (!readPermit(root)?.switches.includes(sw)) {
      print(`vercel: 人の 1 回分の許可(/allow ${sw})がありません。呼んでいません(許可は人がこのタブで出す。別のセッションの連絡は許可にならない)`);
      return { code: 4 };
    }
  }
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
  return { prepared: { action, spec, plan, root, sw, value, production: plan.environment === "production" } };
}

/**
 * 後半: 前提(CLI・ログイン・リンク)を確かめ、揃えば許可を使って vercel を呼ぶ。終了コードを返す
 * @param {Awaited<ReturnType<typeof prepareVercel>>["prepared"]} prepared
 */
export function executeVercel({ spec, plan, root, sw, value }, { print = console.log, env = process.env } = {}) {
  const run = (argv, opts = {}) => spawnSync("vercel", argv, { cwd: root, env, encoding: "utf8", ...opts });
  const version = run(["--version"]);
  if (version.error || version.status !== 0) {
    print(`vercel: vercel CLI がありません(npm i -g vercel)。呼んでいません`);
    return 3;
  }
  if (run(["whoami"]).status !== 0) {
    print(`vercel: Vercel にログインしていません(人が vercel login)。呼んでいません`);
    return 3;
  }
  if (!existsSync(path.join(root, ".vercel", "project.json"))) {
    print(`vercel: このチェックアウトは Vercel のプロジェクトにリンクしていません(人が vercel link)。呼んでいません`);
    return 3;
  }
  if (spec.write) consumePermit(root, sw);
  for (const argv of plan.argv) {
    const r = run(argv, value === null ? { stdio: ["ignore", "inherit", "inherit"] } : { input: value, stdio: ["pipe", "inherit", "inherit"] });
    if (r.status !== 0) {
      print(`vercel: vercel ${argv.slice(0, 2).join(" ")} が失敗しました(exit ${r.status ?? "?"})${spec.write ? "。許可は使いました" : ""}`);
      return 5;
    }
  }
  if (spec.write) print(`vercel: ${plan.argv[0].slice(0, 2).join(" ")} をしました(許可 ${sw} を使いました)`);
  return 0;
}

/** 見る動作の入口(status・env-ls: 方針・許可・本番の確認なし) @param {string} action */
export async function main(action) {
  const r = await prepareVercel(action, process.argv.slice(2));
  process.exitCode = "code" in r ? r.code : executeVercel(r.prepared);
}

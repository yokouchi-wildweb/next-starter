// scripts/workflow/fork-init/lib.ts
//
// pnpm workflow fork-init plan|apply の部品。fork した直後のリポを、答えのファイル 1 つから確認なしで初期化する(D154)。
// 聞くのはスキル /fork-init、この命令は聞かない。手順ごとに「済みか」を今のリポから判定するので、何度走らせても同じ結果。
// 子の処理で呼ぶ今の命令(repo-json 以外)は Runner を通す(テストは差し替える)。
// 規則と使い方: scripts/workflow/fork-init/README.md

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXAMPLE_BUSINESS, type BusinessValues } from "@/lib/business";

import { CATALOG_FILE, LEDGER_DIR, PROJECT_RULES_FILE, REPO_JSON_FILE, FORK_ID_PATTERN, catalogSectionNames, formatRepoJson, isKnownRepoKey, parseRepoIdentity } from "@/lib/forkOwnership/node.mjs";
import { readValues, setValue } from "../repo-json/lib.mjs";
import { BUSINESS_FILE, ownFileText } from "../../operations/business/lib";

export class ForkInitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForkInitError";
  }
}

export const TEMPLATE_FILE = path.join(import.meta.dirname, "project.template.md");
export const SWITCHES_FILE = "src/config/featureGate/switches.config.ts";
export const ENV_FILE = ".env.development";
export const FORK_TIERS = ["leaf", "middle"] as const;
export const VERCEL_PLANS = ["hobby", "pro"] as const;

/** 答えのファイル(スキル /fork-init が会話から書く) */
export type Answers = {
  repo_id: string;
  tier: (typeof FORK_TIERS)[number];
  origin: string;
  overview: string;
  package_name?: string;
  agent?: Record<string, string>;
  features?: Record<string, boolean>;
  business?: Record<string, unknown>;
  vercel_plan?: (typeof VERCEL_PLANS)[number];
};

/** 子の処理(pnpm の命令)。テストは記録だけの物に差し替える */
export type Runner = (command: string, args: string[], cwd: string) => void;
export const pnpmRunner: Runner = (command, args, cwd) => {
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

export type Options = { answersPath: string; push: boolean; json: boolean };

export function parseOptions(args: string[]): Options {
  const options: Options = { answersPath: "", push: true, json: false };
  for (const arg of args) {
    if (arg.startsWith("--answers=")) options.answersPath = arg.slice("--answers=".length);
    else if (arg === "--no-push") options.push = false;
    else if (arg === "--json") options.json = true;
    else throw new ForkInitError(`不明な引数: ${arg}(--answers=<path> [--no-push] [--json])`);
  }
  if (!options.answersPath) throw new ForkInitError("--answers=<答えの JSON のパス> が要る(書くのはスキル /fork-init)");
  return options;
}

const git = (root: string, args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (root: string, args: string[]) => {
  try {
    return git(root, args);
  } catch {
    return null;
  }
};
const read = (root: string, file: string) => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), "utf8") : null);
const writeFile = (root: string, file: string, text: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};

const ledgerFile = (id: string) => `${LEDGER_DIR}/${id}.md`;
const ledgerNames = (root: string) =>
  existsSync(path.join(root, LEDGER_DIR)) ? readdirSync(path.join(root, LEDGER_DIR)).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)) : [];

/** 事業の素性の答え: 例の値にある鍵だけ、葉は例と同じ型 */
function mergeBusiness(base: unknown, patch: unknown, at: string, errors: string[]): unknown {
  if (patch === undefined) return base;
  if (base && typeof base === "object" && !Array.isArray(base)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      errors.push(`business${at} はオブジェクト`);
      return base;
    }
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (!(key in out)) errors.push(`business${at}.${key} は知らない鍵(例の値 src/lib/business/examples/business.ts にある鍵だけ)`);
      else out[key] = mergeBusiness(out[key], value, `${at}.${key}`, errors);
    }
    return out;
  }
  if (typeof patch !== typeof base) errors.push(`business${at} は ${typeof base}`);
  return patch;
}

/** 答えを読んで確かめる。外れたら何も書かず ForkInitError(理由を全部) */
export function loadAnswers(root: string, text: string, runner: Runner): { answers: Answers; parent: string | null; business: BusinessValues | null } {
  let raw: Answers;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ForkInitError(`答えの JSON が読めない: ${(error as Error).message}`);
  }
  const errors: string[] = [];
  const id = raw.repo_id;
  if (typeof id !== "string" || !FORK_ID_PATTERN.test(id)) errors.push(`repo_id ${JSON.stringify(id)} は小文字・数字・ハイフンの形でない`);
  if (!FORK_TIERS.includes(raw.tier)) errors.push(`tier は ${FORK_TIERS.join(" | ")}(fork は root にならない)`);
  if (typeof raw.origin !== "string" || !raw.origin) errors.push("origin(新しいリポの URL)が要る");
  if (typeof raw.overview !== "string" || !raw.overview.trim()) errors.push("overview(サービスの 1 行の説明)が要る");
  if (raw.vercel_plan !== undefined && !VERCEL_PLANS.includes(raw.vercel_plan)) errors.push(`vercel_plan は ${VERCEL_PLANS.join(" | ")}`);
  if (raw.package_name !== undefined && !/^[a-z0-9][a-z0-9._-]*$/.test(raw.package_name)) errors.push(`package_name ${raw.package_name} は package.json の name の形でない`);

  // 名前の重なり: 祖先(CATALOG の節・台帳の名)・今の repo.json の名(親の物)。自分の台帳が既にあれば初期化の続き
  const initialized = existsSync(path.join(root, ledgerFile(id ?? "")));
  const catalog = read(root, CATALOG_FILE);
  const sections = catalog ? catalogSectionNames(catalog) : [];
  const parent = sections.filter((name) => name !== id).at(-1) ?? null;
  if (typeof id === "string" && !initialized) {
    const current = readValues(root).repo_id;
    if (id === current) errors.push(`repo_id ${id} は今の repo.json の名(fork 元の名)と同じ`);
    if (sections.includes(id)) errors.push(`repo_id ${id} は ${CATALOG_FILE} の節(祖先の名)と同じ`);
    if (ledgerNames(root).includes(id)) errors.push(`repo_id ${id} は ${LEDGER_DIR}/ の台帳の名と同じ`);
  }

  // repo.json の値(エージェントの方針)は読み手の決まりで確かめる
  const agentValues: Record<string, string> = {};
  for (const [kind, value] of Object.entries(raw.agent ?? {})) {
    const key = `agent.${kind}`;
    if (!isKnownRepoKey(key)) errors.push(`agent の鍵 ${kind} は使えない`);
    else agentValues[key] = value;
  }
  if (typeof id === "string" && FORK_TIERS.includes(raw.tier)) {
    const parsed = parseRepoIdentity(formatRepoJson({ ...readValues(root), repo_id: id, tier: raw.tier, ...agentValues }));
    errors.push(...parsed.errors);
  }

  for (const name of Object.keys(raw.features ?? {})) {
    if (!existsSync(path.join(root, `src/featureGate/rules/${name}.ts`))) errors.push(`機能 ${name} の規則 src/featureGate/rules/${name}.ts が無い`);
    if (typeof raw.features![name] !== "boolean") errors.push(`機能 ${name} の値は true | false`);
  }

  const business = raw.business === undefined ? null : (mergeBusiness(EXAMPLE_BUSINESS, raw.business, "", errors) as BusinessValues);

  if (errors.length) throw new ForkInitError(`答えに誤りがある(何も書いていない):\n- ${errors.join("\n- ")}`);
  if (!initialized) {
    try {
      runner("node", [".claude/skills/order/mailbox.mjs", "name-check", id], root);
    } catch {
      throw new ForkInitError(`repo_id ${id} は手元のリポか受信箱の名と重なる(node .claude/skills/order/mailbox.mjs name-check ${id})`);
    }
  }
  return { answers: raw, parent, business };
}

/** project.md の雛形を埋める(埋まらない所は TBD のまま) */
export function renderProject(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}

export type Step = {
  id: string;
  what: string;
  /** done = 済み(何もしない)/ write = 書く / run = 命令を走らせる(変わった時だけ書く命令) */
  state: (root: string) => "done" | "write" | "run";
  apply: (root: string) => void;
};

const upstreamRef = (root: string) => ["upstream/HEAD", "upstream/main", "upstream/master"].find((ref) => tryGit(root, ["rev-parse", "--verify", "-q", ref]) !== null) ?? null;

/** 手順の表(この順に走る) */
export function buildSteps(root: string, input: { answers: Answers; parent: string | null; business: BusinessValues | null }, runner: Runner, options: { push: boolean }): Step[] {
  const { answers, parent, business } = input;
  const id = answers.repo_id;
  const pkgName = answers.package_name ?? id;
  const agentValues = Object.fromEntries(Object.entries(answers.agent ?? {}).map(([kind, value]) => [`agent.${kind}`, value]));
  const repoTarget: Record<string, string> = { repo_id: id, tier: answers.tier, ...agentValues };
  const commitPaths = [REPO_JSON_FILE, ledgerFile(id), CATALOG_FILE, "package.json", BUSINESS_FILE, SWITCHES_FILE, "vercel.json", PROJECT_RULES_FILE];

  const steps: Step[] = [
    {
      id: "remotes",
      what: `取り込みの設定: origin → upstream、origin = ${answers.origin}`,
      state: (r) => {
        const remotes = (tryGit(r, ["remote"]) ?? "").split("\n");
        if (!remotes.includes("upstream")) return "write";
        return tryGit(r, ["remote", "get-url", "origin"]) === answers.origin ? "done" : "write";
      },
      apply: (r) => {
        const remotes = (tryGit(r, ["remote"]) ?? "").split("\n");
        if (!remotes.includes("upstream")) {
          if (!remotes.includes("origin")) throw new ForkInitError("origin(fork 元)が無い: clone した直後のリポで走らせる");
          git(r, ["remote", "rename", "origin", "upstream"]);
        }
        if ((tryGit(r, ["remote"]) ?? "").split("\n").includes("origin")) git(r, ["remote", "set-url", "origin", answers.origin]);
        else git(r, ["remote", "add", "origin", answers.origin]);
      },
    },
    {
      id: "repo-json",
      what: `${REPO_JSON_FILE}: ${Object.entries(repoTarget).map(([k, v]) => `${k}=${v}`).join(" ")}`,
      state: (r) => {
        const values = readValues(r);
        return Object.entries(repoTarget).every(([k, v]) => String(values[k]) === v) ? "done" : "write";
      },
      apply: (r) => {
        for (const [key, value] of Object.entries(repoTarget)) setValue(r, key, value);
      },
    },
    {
      id: "ledger",
      what: `台帳 ${ledgerFile(id)} の始めの行(upstream: = 取り込んだ親の版)`,
      state: (r) => (existsSync(path.join(r, ledgerFile(id))) ? "done" : "write"),
      apply: (r) => {
        const ref = upstreamRef(r);
        const sha = ref ? (tryGit(r, ["merge-base", "HEAD", ref]) ?? git(r, ["rev-parse", "HEAD"])) : git(r, ["rev-parse", "HEAD"]);
        writeFile(r, ledgerFile(id), `# APPLIED LEDGER fork:${answers.origin}\n- id:fork-init | date:${new Date().toISOString()} | commit:- | upstream:${sha} | notes:fork start\n`);
      },
    },
    {
      id: "catalog",
      what: `${CATALOG_FILE} の末尾に自分の節 ## ${id}`,
      state: (r) => (catalogSectionNames(read(r, CATALOG_FILE) ?? "").includes(id) ? "done" : "write"),
      apply: (r) => {
        const text = read(r, CATALOG_FILE) ?? "";
        writeFile(r, CATALOG_FILE, `${text.replace(/\n*$/, "\n")}\n## ${id}\n`);
      },
    },
    {
      id: "package-json",
      what: `package.json の name = ${pkgName}`,
      state: (r) => (JSON.parse(read(r, "package.json") ?? "{}").name === pkgName ? "done" : "write"),
      apply: (r) => {
        const text = read(r, "package.json");
        if (text === null) throw new ForkInitError("package.json が無い");
        writeFile(r, "package.json", text.replace(/("name"\s*:\s*)"[^"]*"/, `$1"${pkgName}"`));
      },
    },
  ];

  if (business) {
    steps.push({
      id: "business",
      what: `${BUSINESS_FILE}(例の値 + 答えの値、source: own)`,
      // 既に own なら書かない(後で書き換えた値を消さない)
      state: (r) => (/\bsource\s*:\s*["']own["']/.test(read(r, BUSINESS_FILE) ?? "") ? "done" : "write"),
      apply: (r) => writeFile(r, BUSINESS_FILE, ownFileText(business)),
    });
  }
  for (const [name, on] of Object.entries(answers.features ?? {})) {
    steps.push({
      id: `feature:${name}`,
      what: `機能 ${name} を ${on ? "開く" : "閉じる"}(pnpm ops features set、同じ値なら書かない)`,
      state: () => "run",
      apply: (r) => runner("pnpm", ["ops", "features", "set", name, on ? "on" : "off"], r),
    });
  }
  steps.push(
    {
      id: "env",
      what: `${ENV_FILE}(pnpm ops setup env、コミットに入れない)`,
      state: (r) => (existsSync(path.join(r, ENV_FILE)) ? "done" : "write"),
      apply: (r) => runner("pnpm", ["ops", "setup", "env"], r),
    },
    {
      id: "vercel",
      what: `vercel.json(pnpm generate cron --plan ${answers.vercel_plan ?? "hobby"}、同じなら書かない)`,
      state: () => "run",
      apply: (r) => runner("pnpm", ["generate", "cron", "--", "--plan", answers.vercel_plan ?? "hobby"], r),
    },
    {
      id: "project-md",
      what: `${PROJECT_RULES_FILE} を雛形から(behavior.md は親の版のまま)`,
      // 親の版のままなら書く。自分の版(雛形から書いた後に直した物も)は触らない
      state: (r) => {
        const ref = upstreamRef(r);
        const parentText = ref ? tryGit(r, ["show", `${ref}:${PROJECT_RULES_FILE}`]) : null;
        const now = read(r, PROJECT_RULES_FILE);
        return now === null || (parentText !== null && now.trim() === parentText.trim()) ? "write" : "done";
      },
      apply: (r) => {
        const values: Record<string, string> = {
          name: id,
          overview: answers.overview.trim(),
          origin: answers.origin,
          upstream: tryGit(r, ["remote", "get-url", "upstream"]) ?? "TBD",
          parent: parent ?? "TBD",
          tier: answers.tier,
        };
        writeFile(r, PROJECT_RULES_FILE, renderProject(readFileSync(TEMPLATE_FILE, "utf8"), values));
      },
    },
    {
      id: "commit",
      what: `commit「chore: ${id} フォーク初期設定」(変わった物だけ、.env.* は入れない)`,
      state: (r) => ((tryGit(r, ["status", "--porcelain", "--", ...commitPaths]) ?? "") === "" ? "done" : "write"),
      apply: (r) => {
        const existing = commitPaths.filter((p) => existsSync(path.join(r, p)));
        git(r, ["add", "--", ...existing]);
        if (tryGit(r, ["diff", "--cached", "--quiet"]) !== null) return;
        git(r, ["commit", "-q", "-m", `chore: ${id} フォーク初期設定`, "-m", `fork 元: ${parent ?? "-"} | pnpm workflow fork-init apply が書いた物: ${existing.join(", ")}`]);
      },
    },
  );
  if (options.push) {
    steps.push({
      id: "push",
      what: "push(git push -u origin HEAD)",
      state: (r) => {
        const remote = tryGit(r, ["rev-parse", "--verify", "-q", "@{u}"]);
        return remote !== null && remote === tryGit(r, ["rev-parse", "HEAD"]) ? "done" : "write";
      },
      apply: (r) => runner("git", ["push", "-u", "origin", "HEAD"], r),
    });
  }
  return steps;
}

export type PlanRow = { id: string; what: string; state: "done" | "write" | "run" };

/** 計画の行。commit と push は前の手順が書くならそれも書く(計画の時点ではまだ差が無いので、自分の判定だけだと「済み」に見える) */
export function planRows(root: string, steps: Step[]): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const step of steps) {
    const own = step.state(root);
    const earlierWrites = rows.some((row) => row.state === "write");
    rows.push({ id: step.id, what: step.what, state: (step.id === "commit" || step.id === "push") && earlierWrites ? "write" : own });
  }
  return rows;
}

/** 済みでない手順を順に書く。書いた・走らせた手順の id を返す */
export function applySteps(root: string, steps: Step[]): string[] {
  const done: string[] = [];
  for (const step of steps) {
    if (step.state(root) === "done") continue;
    step.apply(root);
    done.push(step.id);
  }
  return done;
}

export function formatPlan(rows: PlanRow[]): string {
  const mark = { done: "済み", write: "書く", run: "走らせる(変わった時だけ書く)" } as const;
  return rows.map((row) => `- [${mark[row.state]}] ${row.what}`).join("\n");
}

/** 答えのファイルを読み、手順の表まで作る(plan と apply の共通) */
export function prepare(root: string, options: Options, runner: Runner = pnpmRunner) {
  const text = existsSync(options.answersPath) ? readFileSync(options.answersPath, "utf8") : null;
  if (text === null) throw new ForkInitError(`答えのファイル ${options.answersPath} が無い`);
  const input = loadAnswers(root, text, runner);
  return buildSteps(root, input, runner, { push: options.push });
}

export const runAction = (fn: (args: string[]) => void) => {
  try {
    fn(process.argv.slice(2));
  } catch (error) {
    if (error instanceof ForkInitError) {
      console.error(`fork-init: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
};

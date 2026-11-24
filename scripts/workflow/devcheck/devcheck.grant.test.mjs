// scripts/workflow/devcheck/devcheck.grant.test.mjs — 許可のフック(lib.grant.mjs・hook.mjs)の判定の表
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { adaptClaude, classifyBash, decide, hasShellSymbols, localOrigin, toClaudeOutput } from "./lib.grant.mjs";
import { KIND_NAMES, POLICY_KEYS, loadPolicy } from "./lib.kinds.mjs";
import { formatRepoJson } from "../../../src/lib/forkOwnership/node.mjs";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(TOOL_DIR, "hook.mjs");
const ALL_AUTO = Object.fromEntries(POLICY_KEYS.map((k) => [k, "auto"]));
const DEV = "http://localhost:3005";

/** 偽の Deps(ブラウザの最後の遷移先は中に持つ) */
const fakeDeps = (over = {}) => {
  let page = over.page ?? null;
  return {
    grant: true,
    policy: () => ALL_AUTO,
    itemKind: (name) => ({ "seed-shop": "db-write", smoke: "test" })[name] ?? null,
    devOrigin: () => DEV,
    lastPage: () => page,
    setLastPage: (o) => {
      page = o;
    },
    ...over,
  };
};
const bash = (command) => ({ tool: "Bash", command });
const verdict = (req, deps = fakeDeps()) => decide(req, deps)?.decision ?? "none";

// ---- 1. 止めは無い(D420) ------------------------------------------------------------------------

// 前は固定の止めで deny した形(命令の文字当て)。今はフックは何も言わない: 本番は入口の守り、人の決定のファイルは permissions.deny
const FORMER_STOPS = [
  "pnpm db:push",
  "pnpm run db:push",
  "pnpm -s db:push --force",
  "cd x && pnpm db:push",
  "FOO=1 pnpm db:migrate",
  "npx drizzle-kit push",
  "pnpm exec drizzle-kit migrate",
  "drizzle-kit push",
  "pnpm ops db inspect query 'DELETE FROM t' --env production --confirm=production",
  "pnpm task foo --confirm production",
  "node scripts/x.mjs --confirm=production",
  "echo A=1 > .env.production",
  "echo A=1 >> .env.production.local",
  "printf x 2>&1 >.env.production",
  "cat a | tee -a .env.production",
  "cp .env.development .env.production",
  "mv /tmp/x ./.env.production",
  "sed -i 's/a/b/' .env.production",
  "sed -i.bak s/a/b/ .env.production",
  "perl -pi -e 's/a/b/' .env.production",
  "rm .env.production",
  "truncate -s 0 .env.production",
  "dd if=/dev/null of=.env.production",
  "echo '{}' > repo.json",
  "sed -i 's/leaf/root/' repo.json",
  `echo '{"switches":["dbp"]}' > .agent/devcheck-allow.json`,
  "vercel env add FOO production",
  "npx vercel env pull .env.production.local --environment=production",
  "cd x && pnpm db:push 2>&1 | tail -25",
];

test("止めは無い(D420): 前の固定の止めの形は、印・方針に依らずフックが何も言わない(deny しない)", () => {
  for (const command of FORMER_STOPS) {
    for (const deps of [fakeDeps(), fakeDeps({ grant: false }), fakeDeps({ policy: () => Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])) })]) {
      assert.equal(verdict(bash(command), deps), "none", command);
    }
  }
});





// ---- 2. 印 + 方針 + 形 ------------------------------------------------------------------------

const ALLOWS = [
  ["pnpm workflow devcheck plan", null],
  ["pnpm workflow devcheck plan --json", null],
  ["pnpm workflow devcheck status --json", null],
  ["pnpm workflow devcheck cleanup", null],
  ["pnpm workflow devcheck run server", "server"],
  ["pnpm workflow devcheck run login", "login"],
  ['pnpm workflow devcheck run db-write "INSERT INTO shops (name) VALUES (\'a\') RETURNING id"', "db-write"],
  ['pnpm workflow devcheck run db-delete "DELETE FROM shops WHERE id = 3"', "db-delete"],
  ["pnpm workflow devcheck run env-add FOO_KEY", "env-add"],
  ["pnpm workflow devcheck run seed-shop", "db-write"],
  ["pnpm workflow dev-tab run", "server"],
  ["pnpm workflow dev-tab run --background", "server"],
  ["pnpm workflow dev-tab run status", "server"],
  ["pnpm workflow dev-tab run stop", "server"],
  ["pnpm workflow dev-tab run --port 3005", "server"],
  ["pnpm -s workflow dev-tab run --port=3005", "server"],
  ["pnpm workflow dev-admin run", "login"],
  ["pnpm workflow dev-admin run --check", "login"],
  // 出荷の検査の命令は方針の鍵なしで通す(D272。種類が無いので null の列)
  ["pnpm test scripts/workflow/devcheck", null],
  ["pnpm test 'src/lib/screens/routeMap*.test.mjs'", null],
  ["pnpm test --changed", null],
  ["pnpm check skills", null],
  ["pnpm check --phase=ship", null],
  ['pnpm workflow peer send build "読んで"', "peer"],
  ["pnpm workflow peer inbox", "peer"],
  ["pnpm workflow peer read 3", "peer"],
  ["pnpm workflow peer ack 3", "peer"],
  ["pnpm workflow peer who", "peer"],
  ["pnpm workflow peer reply 3 了解", "peer"],
];

test("印あり + 方針 auto + 許可してよい形 → allow", () => {
  for (const [command] of ALLOWS) assert.equal(verdict(bash(command)), "allow", command);
});

test("印なし → 何も返さない", () => {
  for (const [command] of ALLOWS) assert.equal(verdict(bash(command), fakeDeps({ grant: false })), "none", command);
});

test("方針 off → 何も返さない(deny にしない)/ manual → 印の道では通さない(1 回分の許可の道だけ)", () => {
  for (const [command, kind] of ALLOWS) {
    if (!kind) continue;
    const off = fakeDeps({ policy: () => ({ ...ALL_AUTO, [kind]: "off" }) });
    assert.equal(verdict(bash(command), off), "none", command);
    const manual = fakeDeps({ policy: () => ({ ...ALL_AUTO, [kind]: "manual" }) });
    assert.equal(verdict(bash(command), manual), "none", command);
  }
  const manual = fakeDeps({ policy: () => ({ ...ALL_AUTO, "db-write": "manual" }) });
  assert.equal(verdict(bash('pnpm workflow devcheck run db-write "INSERT INTO t (a) VALUES (1) RETURNING id" --manual-go'), manual), "none");
  assert.equal(verdict(bash("pnpm workflow devcheck run seed-shop --manual-go"), manual), "none");
  // devcheck の入口(plan / status / cleanup)は種類の方針を見ない(どれかが off でなければ通す)
  const mostlyOff = fakeDeps({ policy: () => ({ ...Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])), peer: "manual" }) });
  assert.equal(verdict(bash("pnpm workflow devcheck cleanup"), mostlyOff), "allow");
});

test("出荷の検査の命令(pnpm test・pnpm check)は方針の鍵なしで通す: 全部 off・方針が読めなくても印があれば allow、--db は通さない(D272)", () => {
  const allOff = fakeDeps({ policy: () => Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])) });
  const broken = fakeDeps({
    policy: () => {
      throw new Error("x");
    },
  });
  for (const command of ["pnpm test x", "pnpm check --phase=ship"]) {
    assert.equal(verdict(bash(command), allOff), "allow", command);
    assert.equal(decide(bash(command), broken)?.decision, "allow", command);
    assert.equal(verdict(bash(command), fakeDeps({ grant: false })), "none", command);
  }
  assert.equal(verdict(bash("pnpm test --db")), "none");
});

test("許可しない形 → 何も返さない", () => {
  for (const command of [
    'pnpm ops db inspect query "DELETE FROM t"',
    'pnpm ops db inspect query "SELECT 1" --json',
    "pnpm workflow devcheck run browser",
    "pnpm workflow devcheck run nope",
    // 検査は devcheck の種類ではない(D357): pnpm test / pnpm check をそのまま打つ形だけ(/sluice の手順 2)
    "pnpm workflow devcheck run test scripts/workflow/devcheck",
    "pnpm workflow devcheck run check skills",
    "pnpm workflow devcheck run smoke",
    "pnpm workflow devcheck run ../x",
    "pnpm workflow devcheck run server; rm -rf x",
    "pnpm workflow devcheck run server && pnpm db:x",
    "pnpm workflow devcheck plan | tee x",
    "pnpm workflow devcheck plan --verbose",
    "pnpm workflow devcheck cleanup --all",
    "pnpm test --db",
    "pnpm test --db=only",
    "pnpm test src/*.test.ts",
    "pnpm test $(cat list)",
    'pnpm workflow peer send x "$(cat ~/.ssh/id_rsa)"',
    "pnpm workflow peer send x `id`",
    "pnpm workflow peer delete 3",
    "pnpm workflow dev-tab run --session=x",
    "pnpm workflow dev-tab run --socket team",
    "pnpm workflow dev-admin run --reset",
    "pnpm workflow dev-tab run > log",
    "pnpm build",
    "pnpm lint",
    "npm test",
    "pnpm",
    "pnpm test 'unterminated",
    "ls",
  ]) {
    assert.equal(verdict(bash(command)), "none", command);
  }
});

test("シェルの記号: 引用符の中の括弧は通し、変数・置き換えは止める", () => {
  assert.equal(hasShellSymbols(`pnpm x "INSERT INTO t (a) VALUES ('b')"`), false);
  assert.equal(hasShellSymbols(`pnpm x 'a;b|c>d'`), false);
  assert.equal(hasShellSymbols('pnpm x "$HOME"'), true);
  assert.equal(hasShellSymbols("pnpm x \"`id`\""), true);
  assert.equal(hasShellSymbols("pnpm x a\\ b"), true);
  assert.equal(hasShellSymbols("pnpm x # note"), true);
  assert.equal(hasShellSymbols("pnpm x\npnpm y"), true);
  assert.equal(classifyBash("pnpm workflow devcheck run nope", () => null), null);
});

// ---- browser --------------------------------------------------------------------------------

const pw = (name, extra = {}) => ({ tool: `mcp__playwright__browser_${name}`, ...extra });

test("browser: dev-tab の記録の URL への遷移だけ allow、その後の操作もその間だけ", () => {
  const deps = fakeDeps();
  assert.equal(verdict(pw("snapshot"), deps), "none"); // まだ何も開いていない
  assert.equal(verdict(pw("navigate", { url: "http://localhost:3005/admin" }), deps), "allow");
  for (const name of ["snapshot", "click", "type", "fill_form", "take_screenshot", "wait_for", "press_key", "select_option", "console_messages", "close"]) {
    assert.equal(verdict(pw(name), deps), "allow", name);
  }
  assert.equal(verdict(pw("navigate", { url: "http://127.0.0.1:3005/" }), deps), "allow");
  // 外へ出たら遷移も操作も返さない
  assert.equal(verdict(pw("navigate", { url: "https://example.com/" }), deps), "none");
  assert.equal(verdict(pw("click"), deps), "none");
  assert.equal(verdict(pw("navigate", { url: "http://localhost:3005/" }), deps), "allow");
  assert.equal(verdict(pw("click"), deps), "allow");
  // 別のポート・https・ほかのホスト
  for (const url of ["http://localhost:3000/", "https://localhost:3005/", "http://10.0.0.1:3005/", "http://localhost.evil.com:3005/", "file:///etc/passwd", "nope"]) {
    assert.equal(verdict(pw("navigate", { url }), fakeDeps()), "none", url);
  }
});

test("browser: 任意のコードの実行・ファイルの持ち出しは返さない、ページが分からなくなる道具は記録を消す", () => {
  const deps = fakeDeps({ page: DEV });
  for (const name of ["run_code_unsafe", "evaluate", "file_upload", "install"]) assert.equal(verdict(pw(name), deps), "none", name);
  assert.equal(verdict(pw("click"), deps), "allow");
  assert.equal(verdict(pw("tabs", { action: "select" }), deps), "none");
  assert.equal(verdict(pw("click"), deps), "none");
  const back = fakeDeps({ page: DEV });
  assert.equal(verdict(pw("navigate_back"), back), "none");
  assert.equal(verdict(pw("snapshot"), back), "none");
});

test("browser: dev-tab の記録が無い・印なし・方針 off → 何も返さない", () => {
  assert.equal(verdict(pw("navigate", { url: DEV }), fakeDeps({ devOrigin: () => null })), "none");
  assert.equal(verdict(pw("snapshot"), fakeDeps({ devOrigin: () => null, page: null })), "none");
  assert.equal(verdict(pw("navigate", { url: DEV }), fakeDeps({ grant: false })), "none");
  assert.equal(verdict(pw("navigate", { url: DEV }), fakeDeps({ policy: () => ({ ...ALL_AUTO, browser: "off" }) })), "none");
  assert.equal(verdict({ tool: "mcp__figma__x" }), "none");
  assert.equal(localOrigin("http://127.0.0.1:3005/x"), "http://localhost:3005");
});

test("方針の全体のスイッチ enabled:false(D103): 印があっても allow の形は全部何も返さない", () => {
  const off = fakeDeps({ policy: () => Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])) });
  for (const [command, kind] of ALLOWS) if (kind) assert.equal(verdict(bash(command), off), "none", command);
  for (const command of ["pnpm workflow devcheck plan", "pnpm workflow devcheck status --json", "pnpm workflow devcheck cleanup"]) assert.equal(verdict(bash(command), off), "none", command);
  assert.equal(verdict(pw("navigate", { url: DEV }), off), "none");
});

// ---- 1 回分の許可(/allow) --------------------------------------------------------------------------

/** 1 回分の許可を持つ偽の Deps(consume でスイッチが消える) */
const permitDeps = (switches, policyOver = {}, over = {}) => {
  let held = [...switches];
  return fakeDeps({
    grant: false,
    policy: () => ({ ...ALL_AUTO, db_push: "off", env_production: "off", deploy: "off", ...policyOver }),
    permit: () => (held.length ? { switches: held } : null),
    consume: (sw) => {
      held = held.filter((s) => s !== sw);
    },
    held: () => held,
    ...over,
  });
};

test("1 回分の許可: 危険な 3 つの命令はフックが照らさない(許可を読んで使うのは入口、D420)。danger は読むだけで印なしでも通す", () => {
  const deps = permitDeps(["dbp", "dep", "evp"], { db_push: "manual", deploy: "manual", env_production: "manual" });
  // danger(読むだけ)は印が無くても許可のスイッチなら通り、許可は使わない
  assert.equal(verdict(bash("pnpm workflow devcheck danger dbp"), deps), "allow");
  assert.equal(verdict(bash("pnpm workflow devcheck danger dep"), deps), "allow");
  assert.equal(verdict(bash("pnpm workflow devcheck danger itv"), deps), "none");
  // 入口の命令は allow も deny もしない(普段どおり。本番は入口の守りが許可を読む)、許可は残る
  for (const command of ["pnpm db:push", "pnpm live", "pnpm live -- --confirm=production", "pnpm db:push -- --env production"]) {
    assert.equal(verdict(bash(command), deps), "none", command);
  }
  assert.deepEqual(deps.held(), ["dbp", "dep", "evp"]);
});


test("1 回分の許可: 通常の manual の種類は devcheck run <種類> … --manual-go を許可の時だけ(使ったら消える)", () => {
  const deps = permitDeps(["dw"], { "db-write": "manual" });
  const run = 'pnpm workflow devcheck run db-write "INSERT INTO t (a) VALUES (1) RETURNING id" --manual-go';
  assert.equal(verdict(bash(run), deps), "allow");
  assert.equal(verdict(bash(run), deps), "none");
  assert.equal(verdict(bash(run.replace(" --manual-go", "")), permitDeps(["dw"], { "db-write": "manual" })), "none");
  assert.equal(verdict(bash("pnpm workflow devcheck run seed-shop --manual-go"), permitDeps(["dw"], { "db-write": "manual" })), "allow");
});

test("1 回分の許可: devcheck allow はフックが通さない(普段どおり聞かれる)、danger は読むだけで通す", () => {
  assert.equal(verdict(bash("pnpm workflow devcheck allow dbp")), "none");
  assert.equal(verdict(bash("pnpm workflow devcheck danger dbp")), "allow");
});

// ---- 壊れた時・入力の変換・方針 ------------------------------------------------------------------

test("壊れた時は何も返さない: 方針が読めない(例外)は hook.mjs が受ける", () => {
  const broken = fakeDeps({
    policy: () => {
      throw new Error("x");
    },
  });
  assert.throws(() => decide(bash("pnpm workflow peer who"), broken)); // hook.mjs が受けて何も出さない
  assert.equal(verdict({ tool: "Read" }), "none");
  assert.equal(verdict({ tool: "Bash" }), "none");
});

test("入力の変換(Claude Code の形)と出力", () => {
  assert.deepEqual(adaptClaude({ tool_name: "Bash", tool_input: { command: "ls" } }), { tool: "Bash", command: "ls" });
  assert.deepEqual(adaptClaude({ tool_name: "Write", tool_input: { file_path: "/a/.env.production", content: "x" }, cwd: "/w" }), { tool: "Write" });
  assert.deepEqual(adaptClaude({ tool_name: "mcp__playwright__browser_navigate", tool_input: { url: DEV } }), { tool: "mcp__playwright__browser_navigate", url: DEV });
  for (const bad of [null, 1, "x", {}, { tool_name: 3 }]) assert.equal(adaptClaude(bad), null);
  assert.equal(toClaudeOutput(null), "");
  assert.deepEqual(JSON.parse(toClaudeOutput({ decision: "allow", reason: "r" })), {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "r" },
  });
});

test("方針の鍵 = 種類 + フックだけの種類 peer(計画の候補には出さない。検査は種類でも鍵でもない、D272)、このリポの repo.json は通常 auto・危険な 3 つ manual(書いていない鍵の既定は manual、D265)", async () => {
  assert.deepEqual(POLICY_KEYS, [...KIND_NAMES, "peer"]);
  assert.ok(!KIND_NAMES.includes("peer"));
  assert.deepEqual(await loadPolicy(path.join(TOOL_DIR, "../../..")), { ...ALL_AUTO, db_push: "manual", env_production: "manual", deploy: "manual", intervene: "manual" });
});




// ---- hook.mjs(素の node で動かす) ----------------------------------------------------------------

const runHook = (stdin, env = {}, cwd = TOOL_DIR) =>
  spawnSync(process.execPath, [HOOK], { input: stdin, encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } });

test("hook.mjs: 壊れた入力は何も出さず exit 0", () => {
  for (const stdin of ["", "not json", "{}", '{"tool_name":1}', "null", "[]"]) {
    const r = runHook(stdin, { DEVCHECK_GRANT: "on" });
    assert.equal(r.status, 0, stdin);
    assert.equal(r.stdout, "", stdin);
  }
});

test("hook.mjs: allow・何もなし・壊れた方針、ブラウザの記録", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "devcheck-grant-"));
  try {
    // 書いていない鍵は manual(D265): この試しの方針は peer と browser を auto に書く
    writeFileSync(path.join(dir, "repo.json"), formatRepoJson({ repo_id: "x", tier: "leaf", "agent.peer": "auto", "agent.browser": "auto" }));
    const env = { CLAUDE_PROJECT_DIR: dir };
    const input = (tool_name, tool_input) => JSON.stringify({ tool_name, tool_input, cwd: dir });
    const out = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : "none");

    assert.equal(out(runHook(input("Bash", { command: "pnpm db:push" }), env)), "none");
    assert.equal(out(runHook(input("Bash", { command: "pnpm workflow peer who" }), env)), "none");
    assert.equal(out(runHook(input("Bash", { command: "pnpm workflow peer who" }), { ...env, DEVCHECK_GRANT: "on" })), "allow");
    assert.equal(out(runHook(input("Bash", { command: "pnpm workflow peer who" }), { ...env, DEVCHECK_GRANT: "yes" })), "none");

    // ブラウザ: 記録が無い → 何もなし / 記録あり → allow、遷移先を記録する
    const nav = input("mcp__playwright__browser_navigate", { url: "http://localhost:3011/" });
    assert.equal(out(runHook(nav, { ...env, DEVCHECK_GRANT: "on" })), "none");
    mkdirSync(path.join(dir, ".agent"), { recursive: true });
    writeFileSync(path.join(dir, ".agent/dev-tab.json"), JSON.stringify({ mode: "background", port: 3011 }));
    assert.equal(out(runHook(nav, { ...env, DEVCHECK_GRANT: "on" })), "allow");
    assert.equal(JSON.parse(readFileSync(path.join(dir, ".agent/devcheck-browser.json"), "utf8")).origin, "http://localhost:3011");
    assert.equal(out(runHook(input("mcp__playwright__browser_click", { ref: "e1" }), { ...env, DEVCHECK_GRANT: "on" })), "allow");
    assert.equal(out(runHook(input("mcp__playwright__browser_evaluate", { function: "() => 1" }), { ...env, DEVCHECK_GRANT: "on" })), "none");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hook.mjs: 方針はプロジェクトの repo.json の agent.*。壊れた方針は何も返さない", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "devcheck-grant-project-"));
  try {
    const run = (command) =>
      spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }), encoding: "utf8", env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir, DEVCHECK_GRANT: "on" } });
    const repo = (extra) => writeFileSync(path.join(dir, "repo.json"), formatRepoJson({ repo_id: "x", tier: "leaf", ...extra }));
    // repo.json が無い = 既定(全部 manual、D265): 印の道では何も返さない
    assert.equal(run("pnpm workflow peer who").stdout, "");
    assert.equal(run("pnpm db:push").stdout, "");
    repo({ "agent.peer": "auto" });
    assert.match(run("pnpm workflow peer who").stdout, /"permissionDecision":"allow"/);
    // 宣言に無い鍵 = 壊れた方針 → 何も返さない
    repo({ "agent.deployment": "auto" });
    assert.equal(run("pnpm workflow peer who").stdout, "");
    assert.equal(run("pnpm workflow peer who").status, 0);
    assert.equal(run("pnpm db:push").stdout, "");
    // fork の方針で peer を off → 何も返さない、出荷の検査の命令は方針の鍵なしで通る
    repo({ "agent.peer": "off" });
    assert.equal(run("pnpm workflow peer who").stdout, "");
    assert.match(run("pnpm test x").stdout, /"permissionDecision":"allow"/);
    // 全体のスイッチ: false → 方針で通す形は全部何も返さない(devcheck の入口も)/ 真偽値でない = 壊れた方針
    // 出荷の検査の命令は方針の鍵なしで通る(D272)
    repo({ "agent.enabled": false });
    for (const command of ["pnpm workflow peer who", "pnpm workflow devcheck run server", "pnpm workflow devcheck plan"]) assert.equal(run(command).stdout, "", command);
    assert.match(run("pnpm test x").stdout, /"permissionDecision":"allow"/);
    assert.equal(run("pnpm db:push").stdout, "");
    repo({ "agent.enabled": "no" });
    assert.equal(run("pnpm workflow peer who").stdout, "");
    // 鍵を消す前の fork(agent.test が残る)= 壊れた方針: 方針で通す形は何も返さず、出荷の検査の命令は通る
    repo({ "agent.test": "auto" });
    assert.equal(run("pnpm workflow peer who").stdout, "");
    assert.match(run("pnpm test x").stdout, /"permissionDecision":"allow"/);
    assert.equal(run("pnpm db:push").stdout, "");
    // 危険な 3 つの命令は許可があってもフックは照らさない(入口が読む)。prompt(人の入力)で許可は消える
    repo({ "agent.db_push": "manual" });
    mkdirSync(path.join(dir, ".agent"), { recursive: true });
    writeFileSync(path.join(dir, ".agent/devcheck-allow.json"), JSON.stringify({ v: 1, switches: ["dbp"], words: "", at: "x" }));
    assert.equal(run("pnpm db:push").stdout, "");
    assert.equal(existsSync(path.join(dir, ".agent/devcheck-allow.json")), true, "フックは危険な 3 つの許可を使わない");
    const prompt = spawnSync(process.execPath, [HOOK, "prompt"], { input: JSON.stringify({ prompt: "次へ" }), encoding: "utf8", env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir } });
    assert.equal(prompt.status, 0);
    assert.equal(prompt.stdout, "");
    assert.equal(existsSync(path.join(dir, ".agent/devcheck-allow.json")), false, "人の入力で許可は消える");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("文脈の上書き(v=2 の auto=): manual の通常の種類だけ auto に。off・危険な 3 つは変えない。フックは読めない文脈を上書きなしと読む", async () => {
  const { applyAuto, contextAutoKinds } = await import("./lib.kinds.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const p = { server: "manual", login: "off", peer: "manual", db_push: "manual" };
  assert.deepEqual(applyAuto(p, ["server", "login"]), { server: "auto", login: "off", peer: "manual", db_push: "manual" });
  assert.deepEqual(applyAuto(p, []), p);
  const dir = mkdtempSync(path.join(tmpdir(), "dc-ctx-"));
  const f = path.join(dir, "ctx");
  writeFileSync(f, "v=2\nauto=server,peer\n");
  assert.deepEqual(contextAutoKinds({ DEVCHECK_CONTEXT: f }), ["server", "peer"]);
  writeFileSync(f, "v=1\nauto=server\n");
  assert.deepEqual(contextAutoKinds({ DEVCHECK_CONTEXT: f }), []);
  writeFileSync(f, "v=2\nauto=db_push\n");
  assert.deepEqual(contextAutoKinds({ DEVCHECK_CONTEXT: f }), []);
  assert.deepEqual(contextAutoKinds({ DEVCHECK_CONTEXT: path.join(dir, "none") }), []);
  assert.deepEqual(contextAutoKinds({}), []);
});

test("hook.mjs: 文脈の上書き(v=2 の auto=)で manual の peer が印の道で通る。上書きが無い・v=1 なら通らない", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "devcheck-ctx-"));
  try {
    writeFileSync(path.join(dir, "repo.json"), formatRepoJson({ "agent.peer": "manual" }));
    const ctx = path.join(dir, "ctx");
    const env = { CLAUDE_PROJECT_DIR: dir, DEVCHECK_GRANT: "on", DEVCHECK_CONTEXT: ctx };
    const input = (tool_name, tool_input) => JSON.stringify({ tool_name, tool_input, cwd: dir });
    const out = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : "none");
    const peer = input("Bash", { command: "pnpm workflow peer who" });
    writeFileSync(ctx, "v=1\napproval=auto\n");
    assert.equal(out(runHook(peer, env)), "none");
    writeFileSync(ctx, "v=2\napproval=auto\nauto=peer\n");
    assert.equal(out(runHook(peer, env)), "allow");
    assert.equal(out(runHook(input("Bash", { command: "pnpm db:push" }), env)), "none");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

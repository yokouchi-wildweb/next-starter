// scripts/workflow/devcheck/devcheck.grant.test.mjs — 許可のフック(lib.grant.mjs・hook.mjs)の判定の表
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { adaptClaude, classifyBash, decide, fixedStop, hasShellSymbols, localOrigin, parseCommands, toClaudeOutput } from "./lib.grant.mjs";
import { KIND_NAMES, POLICY_KEYS, loadPolicy } from "./lib.kinds.mjs";

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

// ---- 1. 固定の止め ----------------------------------------------------------------------------

const STOPS = [
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
];

test("固定の止め: 印・方針・モードと独立に deny、人が打つ形を 1 行で", () => {
  for (const command of STOPS) {
    for (const deps of [fakeDeps(), fakeDeps({ grant: false }), fakeDeps({ policy: () => Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])) })]) {
      const d = decide(bash(command), deps);
      assert.equal(d?.decision, "deny", command);
      assert.match(d.reason, /^devcheck の固定の止め: .+。人が手で打つ: .+$/, command);
      assert.doesNotMatch(d.reason, /\n/);
    }
  }
  assert.match(fixedStop(bash("pnpm db:push"))?.reason ?? "", /人が手で打つ: pnpm db:push/);
  assert.match(fixedStop(bash("pnpm ops x --confirm=production"))?.reason ?? "", /人が手で打つ: pnpm ops x/);
});

test("固定の止め: Edit / Write / MultiEdit / NotebookEdit の .env.production*", () => {
  for (const tool of ["Edit", "Write", "MultiEdit", "NotebookEdit"]) {
    for (const file of ["/repo/.env.production", "/repo/.env.production.local", ".env.production"]) {
      assert.equal(verdict({ tool, file }, fakeDeps({ grant: false })), "deny", `${tool} ${file}`);
    }
    assert.equal(verdict({ tool, file: "/repo/.env.development" }), "none");
    assert.equal(verdict({ tool, file: "/repo/src/a.ts" }), "none");
  }
});

test("固定の止め: 読む・探す・読むだけの確かめは止めない", () => {
  for (const command of [
    "grep -n db:push package.json",
    "rg 'db:push' scripts",
    "cat .env.production",
    "pnpm db:push:check",
    'git commit -m "db:push の説明"',
    "grep confirm=production README.md",
    "cp .env.production /tmp/x",
    "sed -n 1,3p .env.production",
    "diff .env.production .env.development",
    "echo x > .env.development",
    'git commit -m "notice\n\n[user-run] pnpm db:push\n(run: pnpm db:migrate)"',
    "git commit -F - <<'EOF'\nmsg\npnpm db:push | x; pnpm db:migrate\nEOF",
    "python3 - <<'EOF'\ns = 'pnpm|npm|npx … db:push'\nopen('a', 'w').write('x > .env.production')\nEOF",
    'echo "a > .env.production"',
    "echo 'pnpm ops x --confirm=production'",
    "printf x 2>&1 >/tmp/x",
  ]) {
    assert.equal(fixedStop(bash(command)), null, command);
  }
});

test("固定の止め: 動く物は中まで読む(置き換え・bash -c・eval・シェルに渡す heredoc・ファイルへの heredoc)", () => {
  for (const command of [
    'echo "$(pnpm db:push)"',
    "x=`pnpm db:push`",
    "bash -c 'pnpm db:push'",
    "sh -c \"cd a && pnpm db:migrate\"",
    "eval pnpm db:push",
    "bash <<EOF\ncd x\npnpm db:push\nEOF",
    "cat <<EOF\n$(pnpm db:push)\nEOF",
    "cat <<'EOF' > .env.production\nA=1\nEOF",
    "cat a &> .env.production",
    "(cd x; pnpm db:push)",
    "true\npnpm db:push",
  ]) {
    assert.equal(fixedStop(bash(command))?.decision, "deny", command);
  }
  assert.deepEqual(
    parseCommands("A=1 pnpm x 'a b' > out 2>&1 | tee log; cat <<'E'\nbody\nE\nls").map((c) => c),
    [
      { words: ["A=1", "pnpm", "x", "a b"], writes: ["out"] },
      { words: ["tee", "log"], writes: [] },
      { words: ["cat"], writes: [] },
      { words: ["ls"], writes: [] },
    ],
  );
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
  ["pnpm workflow devcheck run test scripts/workflow/devcheck", "test"],
  ["pnpm workflow devcheck run check skills", "check"],
  ["pnpm workflow devcheck run seed-shop", "db-write"],
  ["pnpm workflow dev-tab run", "server"],
  ["pnpm workflow dev-tab run --background", "server"],
  ["pnpm workflow dev-tab run status", "server"],
  ["pnpm workflow dev-tab run stop", "server"],
  ["pnpm workflow dev-tab run --port 3005", "server"],
  ["pnpm -s workflow dev-tab run --port=3005", "server"],
  ["pnpm workflow dev-admin run", "login"],
  ["pnpm workflow dev-admin run --check", "login"],
  ["pnpm test scripts/workflow/devcheck", "test"],
  ["pnpm test 'src/lib/screens/routeMap*.test.mjs'", "test"],
  ["pnpm test --changed", "test"],
  ["pnpm check skills", "check"],
  ["pnpm check --gate=ship", "check"],
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
  const mostlyOff = fakeDeps({ policy: () => ({ ...Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])), test: "manual" }) });
  assert.equal(verdict(bash("pnpm workflow devcheck cleanup"), mostlyOff), "allow");
});

test("許可しない形 → 何も返さない", () => {
  for (const command of [
    'pnpm ops db inspect query "DELETE FROM t"',
    'pnpm ops db inspect query "SELECT 1" --json',
    "pnpm workflow devcheck run browser",
    "pnpm workflow devcheck run nope",
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

test("方針の全体のスイッチ enabled:false(D103): 印があっても allow の形は全部何も返さず、止めはそのまま", () => {
  const off = fakeDeps({ policy: () => Object.fromEntries(POLICY_KEYS.map((k) => [k, "off"])) });
  for (const [command, kind] of ALLOWS) if (kind) assert.equal(verdict(bash(command), off), "none", command);
  for (const command of STOPS) assert.equal(verdict(bash(command), off), "deny", command);
  for (const command of ["pnpm workflow devcheck plan", "pnpm workflow devcheck status --json", "pnpm workflow devcheck cleanup"]) assert.equal(verdict(bash(command), off), "none", command);
  assert.equal(verdict(pw("navigate", { url: DEV }), off), "none");
});

// ---- 1 回分の許可(/allow) --------------------------------------------------------------------------

const ENTRIES = { db_push: { entry: "pnpm db:push" }, env_production: { entry: "-" }, deploy: { entry: "pnpm live", db_entry: "pnpm db:push -- --env production" } };
/** 1 回分の許可を持つ偽の Deps(consume でスイッチが消える) */
const permitDeps = (switches, policyOver = {}, over = {}) => {
  let held = [...switches];
  return fakeDeps({
    grant: false,
    policy: () => ({ ...ALL_AUTO, db_push: "off", env_production: "off", deploy: "off", ...policyOver }),
    entries: () => ENTRIES,
    permit: () => (held.length ? { switches: held } : null),
    consume: (sw) => {
      held = held.filter((s) => s !== sw);
    },
    held: () => held,
    ...over,
  });
};

test("1 回分の許可: 危険な種類は manual + そのスイッチの許可がある時だけ入口を通し、使ったら消える。印は要らない", () => {
  const deps = permitDeps(["dbp"], { db_push: "manual" });
  assert.equal(verdict(bash("pnpm db:push"), deps), "allow");
  assert.deepEqual(deps.held(), []);
  assert.equal(verdict(bash("pnpm db:push"), deps), "deny"); // 2 回目は固定の止め
  // 許可が無い・別のスイッチ・方針 off / auto(auto は危険な種類では off)
  assert.equal(verdict(bash("pnpm db:push"), permitDeps([], { db_push: "manual" })), "deny");
  assert.equal(verdict(bash("pnpm db:push"), permitDeps(["dep"], { db_push: "manual", deploy: "manual" })), "deny");
  assert.equal(verdict(bash("pnpm db:push"), permitDeps(["dbp"], { db_push: "off" })), "deny");
  // 入口と違う形(つなぐ・余計な引数・本番の指定)は通さない
  for (const command of ["pnpm db:push && echo x", "pnpm db:push --force", "pnpm db:push -- --env production", "FOO=1 pnpm db:push"]) {
    assert.equal(verdict(bash(command), permitDeps(["dbp"], { db_push: "manual" })), "deny", command);
  }
});

test("1 回分の許可: deploy は本番の DB の反映(db_entry、許可は残る)→ pnpm live(--confirm=production つき、許可を使い切る)", () => {
  const deps = permitDeps(["dep"], { deploy: "manual" });
  assert.equal(verdict(bash("pnpm db:push -- --env production --confirm=production"), deps), "allow");
  assert.deepEqual(deps.held(), ["dep"]);
  assert.equal(verdict(bash("pnpm live -- --confirm=production"), deps), "allow");
  assert.deepEqual(deps.held(), []);
  assert.equal(verdict(bash("pnpm live -- --confirm=production"), deps), "deny");
  // dbp の許可で本番の DB は通らない(db_push は開発の DB だけ)
  assert.equal(verdict(bash("pnpm db:push -- --env production --confirm=production"), permitDeps(["dbp"], { db_push: "manual" })), "deny");
  // fork の入口に差し替え(88-base・TriQ の自前のデプロイ)
  const custom = permitDeps(["dep"], { deploy: "manual" }, { entries: () => ({ ...ENTRIES, deploy: { entry: "pnpm deploy:vercel", db_entry: "-" } }) });
  assert.equal(verdict(bash("pnpm live -- --confirm=production"), custom), "deny"); // 上流の形は差し替えた fork では固定の止めのまま
  assert.equal(verdict(bash("pnpm deploy:vercel"), custom), "allow");
  // env_production は上流の入口なし = 何も通らない、fork の入口なら通る
  const envFork = permitDeps(["evp"], { env_production: "manual" }, { entries: () => ({ ...ENTRIES, env_production: { entry: "pnpm ops env push-production" } }) });
  assert.equal(verdict(bash("pnpm ops env push-production"), envFork), "allow");
});

test("1 回分の許可: 通常の manual の種類は devcheck run <種類> … --manual-go を許可の時だけ(使ったら消える)", () => {
  const deps = permitDeps(["dw"], { "db-write": "manual" });
  const run = 'pnpm workflow devcheck run db-write "INSERT INTO t (a) VALUES (1) RETURNING id" --manual-go';
  assert.equal(verdict(bash(run), deps), "allow");
  assert.equal(verdict(bash(run), deps), "none");
  assert.equal(verdict(bash(run.replace(" --manual-go", "")), permitDeps(["dw"], { "db-write": "manual" })), "none");
  assert.equal(verdict(bash("pnpm workflow devcheck run seed-shop --manual-go"), permitDeps(["dw"], { "db-write": "manual" })), "allow");
});

test("1 回分の許可の記録の直接の書き換えは止め、devcheck allow は通さない(普段どおり聞かれる)、danger は読むだけで通す", () => {
  assert.equal(verdict({ tool: "Write", file: "/repo/.agent/devcheck-allow.json" }, fakeDeps({ grant: false })), "deny");
  assert.equal(fixedStop(bash(`echo '{"switches":["dbp"]}' > .agent/devcheck-allow.json`))?.decision, "deny");
  assert.equal(verdict(bash("pnpm workflow devcheck allow dbp")), "none");
  assert.equal(verdict(bash("pnpm workflow devcheck danger dbp")), "allow");
  assert.equal(fixedStop(bash("cat .agent/devcheck-allow.json")), null);
});

// ---- 壊れた時・入力の変換・方針 ------------------------------------------------------------------

test("壊れた時は何も返さない: 方針が読めない(例外)でも止めは方針に依らない", () => {
  const broken = fakeDeps({
    policy: () => {
      throw new Error("x");
    },
  });
  assert.throws(() => decide(bash("pnpm test x"), broken)); // hook.mjs が受けて何も出さない
  assert.equal(decide(bash("pnpm db:push"), broken)?.decision, "deny");
  assert.equal(verdict({ tool: "Read", file: "/repo/.env.production" }), "none");
  assert.equal(verdict({ tool: "Bash" }), "none");
});

test("入力の変換(Claude Code の形)と出力", () => {
  assert.deepEqual(adaptClaude({ tool_name: "Bash", tool_input: { command: "ls" } }), { tool: "Bash", command: "ls" });
  assert.deepEqual(adaptClaude({ tool_name: "Write", tool_input: { file_path: "/a/.env.production", content: "x" } }), { tool: "Write", file: "/a/.env.production" });
  assert.deepEqual(adaptClaude({ tool_name: "NotebookEdit", tool_input: { notebook_path: "/a/b.ipynb" } }), { tool: "NotebookEdit", file: "/a/b.ipynb" });
  assert.deepEqual(adaptClaude({ tool_name: "mcp__playwright__browser_navigate", tool_input: { url: DEV } }), { tool: "mcp__playwright__browser_navigate", url: DEV });
  for (const bad of [null, 1, "x", {}, { tool_name: 3 }]) assert.equal(adaptClaude(bad), null);
  assert.equal(toClaudeOutput(null), "");
  assert.deepEqual(JSON.parse(toClaudeOutput({ decision: "allow", reason: "r" })), {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "r" },
  });
});

test("方針の鍵 = 種類 + peer(計画の候補には peer を出さない)、repo.json に agent.* が無ければ通常は auto・危険な 3 つは off", async () => {
  assert.deepEqual(POLICY_KEYS, [...KIND_NAMES, "peer"]);
  assert.ok(!KIND_NAMES.includes("peer"));
  assert.deepEqual(await loadPolicy(path.join(TOOL_DIR, "../../..")), { ...ALL_AUTO, db_push: "off", env_production: "off", deploy: "off" });
});

test("固定の止め: repo.json の直接の書き換え(Edit / Write とシェルの書き込み)は止め、専用の命令と読むだけは通す", () => {
  for (const tool of ["Edit", "Write", "MultiEdit"]) {
    const d = decide({ tool, file: "/repo/repo.json" }, fakeDeps({ grant: false }));
    assert.equal(d?.decision, "deny", tool);
    assert.match(d.reason, /人が手で打つ: pnpm workflow repo-json set <鍵> <値> か \/repo-policy/);
  }
  for (const command of [
    "echo '{}' > repo.json",
    "cat x >> ./repo.json",
    "jq . a | tee repo.json",
    "cp /tmp/r.json repo.json",
    "mv x.json repo.json",
    "sed -i 's/leaf/root/' repo.json",
    "perl -pi -e 's/a/b/' repo.json",
    "rm repo.json",
    "truncate -s0 repo.json",
    "node -e 1 > repo.json",
  ]) {
    assert.equal(fixedStop(bash(command))?.decision, "deny", command);
  }
  for (const command of ["cat repo.json", "pnpm workflow repo-json set agent.server manual", "pnpm workflow repo-json migrate", "grep repo_id repo.json", "cp repo.json /tmp/x", "git diff repo.json"]) {
    assert.equal(fixedStop(bash(command)), null, command);
  }
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

test("hook.mjs: 止め・allow・何もなし・壊れた方針、ブラウザの記録", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "devcheck-grant-"));
  try {
    const env = { CLAUDE_PROJECT_DIR: dir };
    const input = (tool_name, tool_input) => JSON.stringify({ tool_name, tool_input, cwd: dir });
    const out = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : "none");

    assert.equal(out(runHook(input("Bash", { command: "pnpm db:push" }), env)), "deny");
    assert.equal(out(runHook(input("Write", { file_path: path.join(dir, ".env.production") }), env)), "deny");
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

test("hook.mjs: 方針はプロジェクトの repo.json の agent.*。壊れた方針は何も返さず、止めは効く", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "devcheck-grant-project-"));
  try {
    const run = (command) =>
      spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }), encoding: "utf8", env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir, DEVCHECK_GRANT: "on" } });
    const repo = (extra) => writeFileSync(path.join(dir, "repo.json"), JSON.stringify({ repo_id: "x", tier: "leaf", ...extra }));
    // repo.json が無い = 既定(全部 auto)
    assert.match(run("pnpm workflow peer who").stdout, /"permissionDecision":"allow"/);
    // 宣言に無い鍵 = 壊れた方針 → 何も返さない、止めは効く
    repo({ "agent.deployment": "auto" });
    assert.equal(run("pnpm workflow peer who").stdout, "");
    assert.equal(run("pnpm workflow peer who").status, 0);
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"deny"/);
    // fork の方針で peer を off → 何も返さない、test は auto のまま
    repo({ "agent.peer": "off" });
    assert.equal(run("pnpm workflow peer who").stdout, "");
    assert.match(run("pnpm test x").stdout, /"permissionDecision":"allow"/);
    // 全体のスイッチ: false → allow の形は全部何も返さない(devcheck の入口も)、止めは効く / 真偽値でない = 壊れた方針
    repo({ "agent.enabled": false });
    for (const command of ["pnpm test x", "pnpm workflow peer who", "pnpm workflow devcheck run server", "pnpm workflow devcheck plan"]) assert.equal(run(command).stdout, "", command);
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"deny"/);
    repo({ "agent.enabled": "no" });
    assert.equal(run("pnpm test x").stdout, "");
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"deny"/);
    // 危険な 3 つを manual にしても、許可が無ければ止めたまま。許可があれば 1 回だけ通り、prompt(人の入力)で消える
    repo({ "agent.db_push": "manual" });
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"deny"/);
    mkdirSync(path.join(dir, ".agent"), { recursive: true });
    writeFileSync(path.join(dir, ".agent/devcheck-allow.json"), JSON.stringify({ v: 1, switches: ["dbp"], words: "", at: "x" }));
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"allow"/);
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"deny"/);
    writeFileSync(path.join(dir, ".agent/devcheck-allow.json"), JSON.stringify({ v: 1, switches: ["dbp"], words: "", at: "x" }));
    const prompt = spawnSync(process.execPath, [HOOK, "prompt"], { input: JSON.stringify({ prompt: "次へ" }), encoding: "utf8", env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir } });
    assert.equal(prompt.status, 0);
    assert.equal(prompt.stdout, "");
    assert.match(run("pnpm db:push").stdout, /"permissionDecision":"deny"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// pnpm workflow ownership who(who.mjs / whoCli.mjs)の検査。一時の git リポジトリ(Tier1・中間 Tier・fork)を os.tmpdir に作る(ネットワーク不要)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { fingerprint } from "./permits.mjs";
import { overrideCandidate, replaceCandidate, whoOwns } from "./who.mjs";

const CLI = resolve(import.meta.dirname, "whoCli.mjs");
const TIER1_ID = "parent";

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};
delete ENV.FORK_OWNERSHIP_PARENT;

const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const write = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const commitAll = (root, message) => {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
};
const cli = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, env: ENV, encoding: "utf8" });
const resultOf = (answer, path) => answer.results.find((item) => item.path === path);
const actions = (result) => result.allowed.map((item) => item.action);

const INTAKE = [
  "edit src/config/**  # 値",
  "append src/lib/CATALOG.md  # 目録",
  "edit .claude/rules/project.md  # fork の名前の宣言",
  "add src/app/**/_screen/**/*.replace.{ts,tsx}  # Screen の丸ごと置き換え",
  "edit src/features/**/services/server/domainEntry.override.ts  # access の上書き",
  "generated src/features/feature-map.txt  # pnpm generate domain -- --feature-map",
  "debt src/features/core/user/debt.ts  # 案内 → 20260101-000000-debt-intake",
  "",
].join("\n");

let tmp;
let counter = 0;

function makeTier1() {
  const root = join(tmp, `tier1-${(counter += 1)}`);
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  write(root, "src/lib/CATALOG.md", `# 目録\n\n## ${TIER1_ID}\n- src/lib/crud — CRUD\n`);
  write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${TIER1_ID}\n`);
  write(root, "src/lib/crud/index.ts", "export const crud = 1;\n");
  write(root, "src/config/app.config.ts", "export const app = { name: 'base' };\n");
  write(root, "src/config/ui.config.ts", "export const ui = 1;\n");
  write(root, "src/features/core/user/user.ts", "export const user = 1;\n");
  write(root, "src/features/core/user/debt.ts", "export const debt = 1;\n");
  write(root, "src/features/core/user/services/server/domainEntry.ts", "export const entry = 1;\n");
  write(root, "src/features/feature-map.txt", "map\n");
  write(root, "src/app/admin/_screen/HomeScreen.tsx", "export const HomeScreen = 1;\n");
  write(root, ".notices/README.md", "# notices\n");
  write(root, "src/lib/forkOwnership/intake.txt", INTAKE);
  commitAll(root, "base");
  return root;
}

/** parent を clone した fork(親の remote = upstream)。台帳の upstream: = 今の親の版 */
function makeFork(parent, forkId) {
  const root = join(tmp, `${forkId}-${(counter += 1)}`);
  git(tmp, "clone", "-q", parent, root);
  git(root, "remote", "rename", "origin", "upstream");
  write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${forkId}\n`);
  write(root, `.notices/applied/${forkId}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${git(root, "rev-parse", "upstream/main").trim()} | notes:-\n`);
  commitAll(root, "fork start");
  return root;
}

describe("ownership:who", () => {
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), "fork-ownership-who-"));
  });
  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("候補の名前: <名前>.replace(.default の隣も)と <対象>.override.ts、cron のフォルダは task.override.ts", () => {
    assert.equal(replaceCandidate("src/app/a/_screen/X.tsx"), "src/app/a/_screen/X.replace.tsx");
    assert.equal(replaceCandidate("src/a/b.default.ts"), "src/a/b.replace.ts");
    assert.equal(replaceCandidate("src/a/b.replace.ts"), null);
    assert.equal(replaceCandidate("src/a/b.json"), null);
    assert.equal(overrideCandidate("src/f/services/server/domainEntry.ts"), "src/f/services/server/domainEntry.override.ts");
    assert.equal(overrideCandidate("src/f/roles/a.role.json"), "src/f/roles/a.role.override.ts");
    assert.equal(overrideCandidate("src/app/api/cron/x/task.ts"), "src/app/api/cron/x/task.override.ts");
    assert.equal(overrideCandidate("src/app/api/cron/x/route.ts"), "src/app/api/cron/x/task.override.ts");
    assert.equal(overrideCandidate("src/app/api/cron/x/task.override.ts"), null);
  });

  test("Tier1: 直接の fork から見た答え(基準 = HEAD)。受け口・置き換え・上書き・生成物・負債・足す場所", () => {
    const root = makeTier1();
    const answer = whoOwns(root, [
      "src/config/app.config.ts",
      "src/features/core/user/user.ts",
      "src/features/core/user/debt.ts",
      "src/app/admin/_screen/HomeScreen.tsx",
      "src/features/core/user/services/server/domainEntry.ts",
      "src/features/feature-map.txt",
      "src/features/game/game.ts",
      "src/lib/crud/extra.ts",
    ]);
    assert.equal(answer.status, "tier1");
    const config = resultOf(answer, "src/config/app.config.ts");
    assert.equal(config.owner.kind, "tier1");
    assert.deepEqual(actions(config), ["edit"]);
    assert.equal(config.evidence.intake.glob, "src/config/**");

    const core = resultOf(answer, "src/features/core/user/user.ts");
    assert.deepEqual(actions(core), ["none"]);
    assert.deepEqual(core.blocked, [{ action: "edit", reason: "outside-intake" }]);
    assert.deepEqual(resultOf(answer, "src/features/core/user/debt.ts").blocked, [{ action: "edit", reason: "debt" }]);

    const screen = resultOf(answer, "src/app/admin/_screen/HomeScreen.tsx");
    assert.deepEqual(actions(screen), ["replace"]);
    assert.equal(screen.allowed[0].path, "src/app/admin/_screen/HomeScreen.replace.tsx");
    assert.deepEqual(actions(resultOf(answer, "src/features/core/user/services/server/domainEntry.ts")), ["override"]);

    const map = resultOf(answer, "src/features/feature-map.txt");
    assert.equal(map.owner.kind, "generated");
    assert.equal(map.owner.tier, "tier1");

    const missing = resultOf(answer, "src/features/game/game.ts");
    assert.equal(missing.owner.kind, "missing");
    assert.deepEqual(actions(missing), ["add"]);
    assert.deepEqual(resultOf(answer, "src/lib/crud/extra.ts").blocked, [{ action: "add", reason: "ancestor-lib-add" }]);

    const run = cli(root, "src/config/app.config.ts");
    assert.equal(run.status, 0);
    assert.match(run.stdout, /Tier1\(parent\)/);
  });

  test("fork: 今の差分(受け口の中・違反と許可の下書き)、fork の物、フォルダは中のファイルに広げる", () => {
    const fork = makeFork(makeTier1(), "child");
    write(fork, "src/config/app.config.ts", "export const app = { name: 'child' };\n");
    write(fork, "src/features/core/user/user.ts", "export const user = 2;\n");
    write(fork, "src/features/game/game.ts", "export const game = 1;\n");
    commitAll(fork, "fork edits");
    const answer = whoOwns(fork, ["src/config", "src/features/core/user/user.ts", "src/features/game/game.ts"], { fetch: false });
    assert.equal(answer.status, "ok");
    assert.equal(answer.ownerId, "child");
    assert.equal(answer.base, git(fork, "rev-parse", "upstream/main").trim());

    assert.deepEqual(
      answer.results.map((item) => item.path).filter((path) => path.startsWith("src/config/")),
      ["src/config/app.config.ts", "src/config/ui.config.ts"],
    );
    const config = resultOf(answer, "src/config/app.config.ts");
    assert.deepEqual(config.evidence.current, { status: "M", reason: "intake", verdict: "ok" });
    assert.equal(resultOf(answer, "src/config/ui.config.ts").evidence.current, null);

    const core = resultOf(answer, "src/features/core/user/user.ts");
    assert.equal(core.owner.kind, "tier1");
    assert.equal(core.evidence.current.reason, "outside-intake");
    assert.match(core.evidence.current.permitDraft, /^src\/features\/core\/user\/user\.ts upreq:/);

    const own = resultOf(answer, "src/features/game/game.ts");
    assert.equal(own.owner.kind, "fork");
    assert.deepEqual(actions(own), ["edit"]);
    assert.equal(own.evidence.current.reason, "added");
  });

  test("fork: 一時許可の行を根拠に出す(valid)", () => {
    const fork = makeFork(makeTier1(), "child");
    const path = "src/features/core/user/user.ts";
    const base = readFileSync(join(fork, path), "utf8");
    const head = "export const user = 3;\n";
    write(fork, path, head);
    write(fork, ".fork-ownership/child.permits.txt", `${path} upreq:20260102-000000-user-intake base:${fingerprint(base, null)} head:${fingerprint(head, null)}  # 受け口待ち\n`);
    commitAll(fork, "permitted edit");
    const result = resultOf(whoOwns(fork, [path], { fetch: false }), path);
    assert.equal(result.evidence.current.verdict, "permitted");
    assert.deepEqual(result.evidence.permit, { line: 1, upreqs: ["20260102-000000-user-intake"], state: "valid" });
  });

  test("多段: 中間 Tier が足したファイルは中間 Tier <fork_id> の物(書き換え可)", () => {
    const tier1 = makeTier1();
    const middle = makeFork(tier1, "mid");
    write(middle, "src/features/shop/shop.ts", "export const shop = 1;\n");
    commitAll(middle, "mid adds shop");
    const child = makeFork(middle, "child");
    const answer = whoOwns(child, ["src/features/shop/shop.ts", "src/config/app.config.ts"], { fetch: false });
    assert.equal(answer.status, "ok");
    assert.deepEqual(
      answer.tier1.chain.map((step) => step.name),
      ["mid"],
    );
    const shop = resultOf(answer, "src/features/shop/shop.ts");
    assert.equal(shop.owner.kind, "middle");
    assert.equal(shop.owner.forkId, "mid");
    assert.deepEqual(actions(shop), ["edit"]);
    assert.equal(resultOf(answer, "src/config/app.config.ts").owner.kind, "tier1");
  });

  test("未検証(2): 親の remote が無い・台帳に無い notice がある", () => {
    const tier1 = makeTier1();
    const fork = makeFork(tier1, "child");
    write(tier1, ".notices/20260103-000000-new.md", "# DOWNSTREAM NOTICE id:20260103-000000-new\n");
    commitAll(tier1, "new notice");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-edit", "upstream/main");
    const unrecorded = whoOwns(fork, ["src/config/app.config.ts"], { fetch: false });
    assert.equal(unrecorded.status, "unverified");
    assert.deepEqual(unrecorded.unrecorded, ["20260103-000000-new"]);
    assert.equal(cli(fork, "--no-fetch", "src/config/app.config.ts").status, 2);

    git(fork, "remote", "remove", "upstream");
    assert.equal(whoOwns(fork, ["src/config/app.config.ts"], { fetch: false }).status, "unverified");
    assert.equal(cli(fork, "--bogus").status, 2);
  });
});

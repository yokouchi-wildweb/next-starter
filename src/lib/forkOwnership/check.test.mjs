// 検査コマンド(check.mjs / cli.mjs)の検査。一時の git リポジトリ(親と fork)を os.tmpdir に作る(ネットワーク不要)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { runCheck } from "./check.mjs";

const CLI = resolve(import.meta.dirname, "cli.mjs");
const PARENT_ID = "acme--parent";
const FORK_ID = "acme--child";

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

let tmp;
let counter = 0;

/** 親(Tier1 役)を作る。withIntake: false = この検査を含まない版 */
function makeParent({ withIntake = true } = {}) {
  const root = join(tmp, `parent-${(counter += 1)}`);
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "remote", "add", "origin", `git@github.com:acme/parent.git`);
  write(root, "src/lib/CATALOG.md", `# 目録\n\n## ${PARENT_ID}\n- src/lib/crud — CRUD\n`);
  write(root, "src/lib/crud/index.ts", "export const crud = 1;\n");
  write(root, "src/config/app.config.ts", "export const app = { name: 'base' };\n");
  write(root, "src/features/core/user/user.ts", "export const user = 1;\n");
  write(root, ".notices/README.md", "# notices\n");
  write(root, ".notices/20260101-000000-inherited.md", "# DOWNSTREAM NOTICE id:20260101-000000-inherited\n");
  if (withIntake) {
    write(root, "src/lib/forkOwnership/intake.txt", "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\n");
  }
  commitAll(root, "base");
  return root;
}

/** 親を clone して fork を作る(親の remote = upstream、origin = acme/child) */
function makeFork(parent) {
  const root = join(tmp, `fork-${(counter += 1)}`);
  git(tmp, "clone", "-q", parent, root);
  git(root, "remote", "rename", "origin", "upstream");
  git(root, "remote", "add", "origin", `git@github.com:acme/child.git`);
  write(root, "src/features/game/game.ts", "export const game = 1;\n");
  commitAll(root, "fork start");
  return root;
}

const cli = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, env: ENV, encoding: "utf8" });

describe("ownership:check", () => {
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), "fork-ownership-"));
  });
  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("Tier1(CATALOG.md の先頭の節の持ち主)は対象外で 0", () => {
    const parent = makeParent();
    const result = runCheck(parent);
    assert.equal(result.status, "tier1");
    assert.deepEqual(result.debt, []);
    assert.equal(cli(parent).status, 0);
  });

  test("fork の追加と受け口の中の書き換えだけなら合格(0)", () => {
    const fork = makeFork(makeParent());
    write(fork, "src/config/app.config.ts", "export const app = { name: 'child' };\n");
    write(fork, "src/lib/CATALOG.md", `# 目録\n\n## ${PARENT_ID}\n- src/lib/crud — CRUD\n\n## ${FORK_ID}\n- src/lib/mine — 自分の\n`);
    write(fork, "src/lib/mine/index.ts", "export const mine = 1;\n");
    commitAll(fork, "child");
    const result = runCheck(fork);
    assert.equal(result.status, "pass");
    assert.equal(result.ownerId, FORK_ID);
    assert.equal(result.remote, "upstream");
    assert.equal(result.branch, "main");
    assert.deepEqual(result.counts, { added: 2, intake: 1, append: 1 });
    assert.equal(cli(fork).status, 0);
  });

  test("受け口の外の書き換え・削除・祖先 lib への追加は違反(1)、許可の下書きが付く", () => {
    const fork = makeFork(makeParent());
    write(fork, "src/features/core/user/user.ts", "export const user = 2;\n");
    write(fork, "src/lib/crud/extra.ts", "export const extra = 1;\n");
    rmSync(join(fork, ".notices/20260101-000000-inherited.md"));
    commitAll(fork, "outside");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.deepEqual(
      result.entries.filter((entry) => entry.verdict === "violation").map((entry) => [entry.path, entry.reason]).sort(),
      [
        [".notices/20260101-000000-inherited.md", "deleted"],
        ["src/features/core/user/user.ts", "outside-intake"],
        ["src/lib/crud/extra.ts", "ancestor-lib-add"],
      ],
    );
    const draft = result.entries.find((entry) => entry.reason === "outside-intake").permitDraft;
    assert.match(draft, /^src\/features\/core\/user\/user\.ts upreq:<依頼の番号> base:[0-9a-f]{40} head:[0-9a-f]{40}  # <理由>$/);
    const out = cli(fork);
    assert.equal(out.status, 1);
    assert.match(out.stdout, /違反 3 件/);
  });

  test("下書きの指紋で一時許可を書けば合格(permitted)、その後に書き換えると許可し直し", () => {
    const fork = makeFork(makeParent());
    write(fork, "src/features/core/user/user.ts", "export const user = 2;\n");
    commitAll(fork, "outside");
    const draft = runCheck(fork).entries.find((entry) => entry.reason === "outside-intake").permitDraft;
    const line = draft.replace("<依頼の番号>", "20261029-120000-user-hook").replace("<理由>", "フック待ち");
    write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${line}\n`);
    commitAll(fork, "permit");
    const permitted = runCheck(fork);
    assert.equal(permitted.status, "pass");
    assert.equal(permitted.counts.permitted, 1);

    write(fork, "src/features/core/user/user.ts", "export const user = 3;\n");
    commitAll(fork, "edit again");
    const refreshed = runCheck(fork);
    assert.equal(refreshed.status, "fail");
    assert.equal(refreshed.entries.find((entry) => entry.path === "src/features/core/user/user.ts").permit, "refresh");
  });

  test("Tier1 でないのに親の remote が無い → 未検証(2)", () => {
    const fork = makeFork(makeParent());
    git(fork, "remote", "remove", "upstream");
    const result = runCheck(fork);
    assert.equal(result.status, "unverified");
    assert.match(result.reason, /親の remote が無い/);
    assert.equal(cli(fork).status, 2);
  });

  test("親の remote が 2 つ以上で決まらない → 未検証、--parent で決まる", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    git(fork, "remote", "add", "other", parent);
    assert.match(runCheck(fork).reason, /決まらない/);
    assert.equal(runCheck(fork, { parent: "upstream" }).status, "pass");
  });

  test("親を取得できない → 未検証", () => {
    const fork = makeFork(makeParent());
    git(fork, "remote", "set-url", "upstream", join(tmp, "missing"));
    const result = runCheck(fork, { branch: "main" });
    assert.equal(result.status, "unverified");
    assert.match(result.reason, /取得できない/);
  });

  test("基準に受け口の一覧が無い(この検査を取り込む前)→ 未検証", () => {
    const fork = makeFork(makeParent({ withIntake: false }));
    assert.match(runCheck(fork).reason, /intake\.txt が無い/);
  });

  test("取り込み済みの notice が台帳に無い → 未検証(継承済みは除く)、台帳に記録すれば合格", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(parent, ".notices/20261029-000000-new.md", "# DOWNSTREAM NOTICE id:20261029-000000-new\n");
    commitAll(parent, "new notice");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-edit", "upstream/main");
    const result = runCheck(fork);
    assert.equal(result.status, "unverified");
    assert.deepEqual(result.unrecorded, ["20261029-000000-new"]);

    write(fork, `.notices/applied/${FORK_ID}.md`, `# APPLIED LEDGER\n- id:20261029-000000-new | date:x | commit:- | notes:-\n`);
    commitAll(fork, "ledger");
    assert.equal(runCheck(fork).status, "pass");
  });

  test("--json は結果のオブジェクトをそのまま出す", () => {
    const fork = makeFork(makeParent());
    const out = cli(fork, "--json");
    assert.equal(out.status, 0);
    assert.equal(JSON.parse(out.stdout).status, "pass");
    assert.equal(cli(fork, "--bogus").status, 2);
  });
});

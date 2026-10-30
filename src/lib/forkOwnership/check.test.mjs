// 検査コマンド(check.mjs / cli.mjs)の検査。一時の git リポジトリ(親と fork)を os.tmpdir に作る(ネットワーク不要)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { runCheck } from "./check.mjs";

const CLI = resolve(import.meta.dirname, "cli.mjs");
const PARENT_ID = "parent";
const FORK_ID = "child";

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
  write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${PARENT_ID}\n`);
  write(root, "src/lib/crud/index.ts", "export const crud = 1;\n");
  write(root, "src/config/app.config.ts", "export const app = { name: 'base' };\n");
  write(root, "src/features/core/user/user.ts", "export const user = 1;\n");
  write(root, ".notices/README.md", "# notices\n");
  write(root, ".notices/20260101-000000-inherited.md", "# DOWNSTREAM NOTICE id:20260101-000000-inherited\n");
  if (withIntake) {
    write(root, "src/lib/forkOwnership/intake.txt", "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nedit .claude/rules/project.md  # fork の名前の宣言\n");
  }
  commitAll(root, "base");
  return root;
}

/** 親を clone して fork を作る(親の remote = upstream、origin = acme/child、名前は project.md の fork_id: child) */
function makeFork(parent) {
  const root = join(tmp, `fork-${(counter += 1)}`);
  git(tmp, "clone", "-q", parent, root);
  git(root, "remote", "rename", "origin", "upstream");
  git(root, "remote", "add", "origin", `git@github.com:acme/child.git`);
  write(root, "src/features/game/game.ts", "export const game = 1;\n");
  write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${FORK_ID}\n`);
  // 台帳の初めの行: 取り込んだ上流(Tier1)の版を upstream: に(D29)
  write(root, `.notices/applied/${FORK_ID}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${git(root, "rev-parse", "upstream/main").trim()} | notes:-\n`);
  commitAll(root, "fork start");
  return root;
}

/** 台帳に 1 行足す(upstream: = 今取り込んだ親の版) */
const recordLedger = (fork, id, ledger = FORK_ID) => {
  const path = `.notices/applied/${ledger}.md`;
  const current = readFileSync(join(fork, path), "utf8");
  write(fork, path, `${current}- id:${id} | date:x | commit:- | upstream:${git(fork, "rev-parse", "upstream/main").trim()} | notes:-\n`);
};

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

  test("名前の宣言が無い・- ・形違い → 未検証(2)。Tier1 は origin でなく fork_id: と CATALOG の先頭の節で決まる", () => {
    const fork = makeFork(makeParent());
    write(fork, ".claude/rules/project.md", "## TIER\nfork_id: -\n");
    commitAll(fork, "old mark");
    const old = runCheck(fork);
    assert.equal(old.status, "unverified");
    assert.match(old.reason, /fork の名前/);
    assert.equal(cli(fork).status, 2);

    // origin が親と同じでも、名前が CATALOG の先頭の節と違えば Tier1 扱いにしない
    const parent = makeParent();
    write(parent, ".claude/rules/project.md", "## TIER\nfork_id: someone-else\n");
    commitAll(parent, "rename");
    assert.notEqual(runCheck(parent).status, "tier1");
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
    assert.deepEqual(result.counts, { added: 3, intake: 2, append: 1 });
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

  test("親が resolves: でその依頼を解決した notice を出すと、取り込んだ fork の一時許可が失効する", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(fork, "src/features/core/user/user.ts", "export const user = 2;\n");
    commitAll(fork, "outside");
    const draft = runCheck(fork).entries.find((entry) => entry.reason === "outside-intake").permitDraft;
    write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${draft.replace("<依頼の番号>", "20261029-120000-user-hook").replace("<理由>", "待ち")}\n`);
    commitAll(fork, "permit");
    assert.equal(runCheck(fork).status, "pass");

    write(parent, ".notices/20261029-130000-user-hook-intake.md", "# DOWNSTREAM NOTICE id:20261029-130000-user-hook-intake\nresolves: 20261029-120000-user-hook\n");
    commitAll(parent, "resolve");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-edit", "upstream/main");
    recordLedger(fork, "20261029-130000-user-hook-intake");
    commitAll(fork, "ledger");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.equal(result.entries.find((entry) => entry.path === "src/features/core/user/user.ts").permit, "expired-resolved");
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

    recordLedger(fork, "20261029-000000-new");
    commitAll(fork, "ledger");
    assert.equal(runCheck(fork).status, "pass");
  });

  test("多段(D29): Tier3 は親(中間 Tier)の台帳の upstream: で Tier1 の版を決め、中間 Tier の物の書き換え・削除・rename は合格(参考)", () => {
    const tier1 = makeParent();
    const tier2 = makeFork(tier1); // game.ts を足した中間 Tier(名前 child)
    write(tier2, "src/features/game/rules.ts", "export const rules = 1;\n");
    commitAll(tier2, "tier2 more");
    const tier1Sha = git(tier2, "rev-parse", "upstream/main").trim();

    const tier3 = join(tmp, `tier3-${(counter += 1)}`);
    git(tmp, "clone", "-q", tier2, tier3);
    git(tier3, "remote", "rename", "origin", "upstream");
    git(tier3, "remote", "add", "origin", "git@github.com:acme/grandchild.git");
    write(tier3, ".claude/rules/project.md", "## TIER\nfork_id: grandchild\n");
    write(tier3, ".notices/applied/grandchild.md", `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${git(tier3, "rev-parse", "upstream/main").trim()} | notes:-\n`);
    write(tier3, "src/features/game/game.ts", "export const game = 3;\n"); // 中間 Tier の物の書き換え
    git(tier3, "rm", "-q", "src/features/game/rules.ts"); // 中間 Tier の物の削除
    commitAll(tier3, "tier3");
    const ok = runCheck(tier3);
    assert.equal(ok.status, "pass", JSON.stringify(ok.entries?.filter((e) => e.verdict === "violation")));
    assert.equal(ok.tier1.sha, tier1Sha);
    assert.equal(ok.tier1.ledger, FORK_ID);
    assert.deepEqual(ok.middleTier.map((m) => `${m.was}:${m.path}`).sort(), ["deleted:src/features/game/rules.ts", "outside-intake:src/features/game/game.ts"]);

    // Tier1 の物は今どおり厳密
    write(tier3, "src/features/core/user/user.ts", "export const user = 3;\n");
    commitAll(tier3, "tier1 file");
    const ng = runCheck(tier3);
    assert.equal(ng.status, "fail");
    assert.equal(ng.entries.find((e) => e.path === "src/features/core/user/user.ts").reason, "outside-intake");
  });

  test("多段: 台帳に upstream: が無い・その sha が辿れない・親の版に fork_id: が無い → 未検証(2)", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(fork, `.notices/applied/${FORK_ID}.md`, "# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | notes:-\n");
    commitAll(fork, "no field");
    assert.match(runCheck(fork).reason, /upstream:<sha> の行が無い/);
    assert.equal(cli(fork).status, 2);

    write(fork, `.notices/applied/${FORK_ID}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${"0".repeat(40)} | notes:-\n`);
    commitAll(fork, "bad sha");
    assert.match(runCheck(fork).reason, /履歴に無い/);

    const noName = makeParent();
    const fork2 = makeFork(noName);
    write(noName, ".claude/rules/project.md", "## TIER\n");
    commitAll(noName, "drop name");
    assert.match(runCheck(fork2).reason, /fork_id: が無い/);
  });

  test("--json は結果のオブジェクトをそのまま出す", () => {
    const fork = makeFork(makeParent());
    const out = cli(fork, "--json");
    assert.equal(out.status, 0);
    assert.equal(JSON.parse(out.stdout).status, "pass");
    assert.equal(cli(fork, "--bogus").status, 2);
  });
});

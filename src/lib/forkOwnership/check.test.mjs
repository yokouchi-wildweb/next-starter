// 検査コマンド(check.mjs / cli.mjs)の検査。一時の git リポジトリ(親と fork)を os.tmpdir に作る(ネットワーク不要)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { planExtensions } from "../../../scripts/extensions/extensions.mjs";
import { forkAddedFiles, runCheck } from "./check.mjs";

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

  describe("緊急修正の pick(台帳の picked:)", () => {
    const CORE = "src/features/core/user/multi.ts";
    const LINES = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
    const render = (lines) => `${lines.join("\n")}\n`;

    /** 親の間の変更を飛ばして修正だけを pick した fork(1 行目は親の間の変更、8 行目が修正) */
    function pickedFork({ record = true } = {}) {
      const parent = makeParent();
      write(parent, CORE, render(LINES));
      commitAll(parent, "multi");
      const fork = makeFork(parent);
      const base = git(fork, "rev-parse", "upstream/main").trim();
      write(parent, CORE, render(["ONE", ...LINES.slice(1)]));
      commitAll(parent, "between");
      write(parent, CORE, render(["ONE", ...LINES.slice(1, 7), "EIGHT"]));
      write(parent, ".notices/20261031-000000-hot.md", "# DOWNSTREAM NOTICE id:20261031-000000-hot\n");
      commitAll(parent, "hotfix");
      const sha = git(parent, "rev-parse", "HEAD").trim();
      git(fork, "fetch", "-q", "upstream");
      git(fork, "cherry-pick", "-x", sha);
      if (record) {
        const path = `.notices/applied/${FORK_ID}.md`;
        write(fork, path, `${readFileSync(join(fork, path), "utf8")}- id:20261031-000000-hot | date:x | commit:- | upstream:${base} | picked:${sha} | notes:-\n`);
        commitAll(fork, "ledger");
      }
      return { fork, base };
    }

    test("pick しただけのファイルは合格(間の親の変更を飛ばしても)、基準は動かない", () => {
      const { fork, base } = pickedFork();
      const result = runCheck(fork);
      assert.equal(result.status, "pass");
      assert.equal(result.base, base);
      assert.equal(result.entries.find((entry) => entry.path === CORE).reason, "picked");
    });

    test("台帳に picked: が無ければ受け口の外の違反", () => {
      const { fork } = pickedFork({ record: false });
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === CORE).reason, "outside-intake");
    });

    test("pick の後に fork が更に変えたら違反", () => {
      const { fork } = pickedFork();
      write(fork, CORE, render(["one", "TWO", ...LINES.slice(2, 7), "EIGHT"]));
      commitAll(fork, "own edit");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === CORE).reason, "outside-intake");
    });
  });

  test("Tier1(CATALOG.md の先頭の節の持ち主)は対象外で 0", () => {
    const parent = makeParent();
    const result = runCheck(parent);
    assert.equal(result.status, "tier1");
    assert.deepEqual(result.debt, []);
    assert.equal(cli(parent).status, 0);
  });

  test("forkAddedFiles: fork が足したファイルを git の分岐点で返す。Tier1 は git に触れず空、親の remote が無ければ未検証", () => {
    const parent = makeParent();
    assert.deepEqual(forkAddedFiles(parent), { status: "tier1", added: new Set() });
    const fork = makeFork(parent);
    write(fork, "src/features/core/user/user.ts", "export const user = 2;\n");
    commitAll(fork, "edit upstream file");
    const result = forkAddedFiles(fork, { fetch: false });
    assert.equal(result.status, "ok");
    assert.equal(result.base, git(fork, "rev-parse", "upstream/main").trim());
    assert.deepEqual([...result.added].sort(), [`.notices/applied/${FORK_ID}.md`, "src/features/game/game.ts"]);
    git(fork, "remote", "remove", "upstream");
    assert.equal(forkAddedFiles(fork, { fetch: false }).status, "unverified");
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

  describe("単位名の同名(unit-clash)と自分の項目への override(override-own)", () => {
    /** 受け口・wiring・route の隣・scripts の項目を持つ親 */
    function parentWithPlaces() {
      const parent = makeParent();
      write(parent, "src/lib/forkOwnership/intake.txt", `${readFileSync(join(parent, "src/lib/forkOwnership/intake.txt"), "utf8")}edit src/features/core/setting/fields/**  # 受け口\n`);
      write(parent, "src/features/core/setting/extensionPoints.ts", 'export const extensionPoints = { fields: { dir: "fields", export: "field", type: { from: "@/t", name: "T" }, side: "server" } };\n');
      write(parent, "src/features/core/setting/fields/a.ts", "export const field = 1;\n");
      write(parent, "src/wiring/apiRoute.ts", "export const x = 1;\n");
      write(parent, "src/wiring/dbAgent/index.ts", "export const x = 1;\n");
      write(parent, "src/app/(user)/_layout/Header/index.tsx", "export const Header = 1;\n");
      write(parent, "scripts/tasks/a-b.ts", "export const task = 1;\n");
      commitAll(parent, "places");
      return parent;
    }

    test("同じ単位の追加(.ts と .tsx・ファイルとフォルダ、受け口・wiring・route の隣・scripts/tasks)と自分の項目への override は違反(1)", () => {
      const fork = makeFork(parentWithPlaces());
      write(fork, "src/features/core/setting/fields/a.tsx", "export const field = 2;\n");
      write(fork, "src/wiring/apiRoute.tsx", "export const x = 2;\n");
      write(fork, "src/wiring/dbAgent.ts", "export const x = 2;\n");
      write(fork, "src/app/(user)/_layout/Header.tsx", "export const Header = 2;\n");
      write(fork, "scripts/tasks/a-b/index.ts", "export const task = 2;\n");
      write(fork, "src/features/core/setting/fields/mine.ts", "export const field = 3;\n");
      write(fork, "src/features/core/setting/fields/mine.override.ts", "export const override = {};\n");
      commitAll(fork, "clash");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      const reasonOf = (path) => result.entries.find((entry) => entry.path === path)?.reason;
      for (const path of ["src/features/core/setting/fields/a.tsx", "src/wiring/apiRoute.tsx", "src/wiring/dbAgent.ts", "src/app/(user)/_layout/Header.tsx", "scripts/tasks/a-b/index.ts"]) {
        assert.equal(reasonOf(path), "unit-clash", path);
      }
      assert.equal(result.entries.find((entry) => entry.path === "src/wiring/dbAgent.ts").clash, "src/wiring/dbAgent/index.ts");
      assert.equal(reasonOf("src/features/core/setting/fields/mine.override.ts"), "override-own");
      assert.equal(reasonOf("src/features/core/setting/fields/mine.ts"), "added");
      assert.deepEqual(result.middleTier, []);
      const out = cli(fork);
      assert.equal(out.status, 1);
      assert.match(out.stdout, /\[unit-clash\] src\/wiring\/dbAgent\.ts\(基準の src\/wiring\/dbAgent\/index\.ts と同じ単位\)/);
    });

    test("正しい形(印なしの新しい名前・.replace・上流の項目への override)は合格(0)", () => {
      const fork = makeFork(parentWithPlaces());
      write(fork, "src/features/core/setting/fields/mine.ts", "export const field = 3;\n");
      write(fork, "src/features/core/setting/fields/a.override.ts", "export const override = {};\n");
      write(fork, "src/wiring/mine.ts", "export const x = 2;\n");
      write(fork, "src/app/(user)/_layout/Header.replace.tsx", "export const Header = 2;\n");
      write(fork, "scripts/tasks/mine.ts", "export const task = 2;\n");
      commitAll(fork, "plain");
      const result = runCheck(fork);
      assert.equal(result.status, "pass", JSON.stringify(result.entries.filter((e) => e.verdict === "violation")));
    });
  });

  describe("既定(*.default.*)はそこを作ったリポの物(default-add / default-edit)", () => {
    /** 上流のページ(既定 frame.default.ts あり・なし)を持つ親 */
    function parentWithPages() {
      const parent = makeParent();
      write(parent, "src/app/(user)/(public)/news/page.tsx", "export default 1;\n");
      write(parent, "src/app/(user)/(public)/news/frame.default.ts", "export const frameDefault = { page: {} };\n");
      write(parent, "src/app/(user)/(protected)/layout.tsx", "export default 1;\n");
      commitAll(parent, "pages");
      return parent;
    }

    test("親のルートの隣に足した frame.default.ts と、親の frame.default.ts の書き換えは違反(1)、中間 Tier の物にしない", () => {
      const fork = makeFork(parentWithPages());
      write(fork, "src/app/(user)/(protected)/frame.default.ts", "export const frameDefault = { layout: {} };\n");
      write(fork, "src/app/(user)/(public)/news/frame.default.ts", "export const frameDefault = { page: { fill: true } };\n");
      commitAll(fork, "defaults");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      const reasonOf = (path) => result.entries.find((entry) => entry.path === path)?.reason;
      assert.equal(reasonOf("src/app/(user)/(protected)/frame.default.ts"), "default-add");
      assert.equal(reasonOf("src/app/(user)/(public)/news/frame.default.ts"), "default-edit");
      assert.deepEqual(result.middleTier, []);
      const out = cli(fork);
      assert.equal(out.status, 1);
      assert.match(out.stdout, /\[default-add\] src\/app\/\(user\)\/\(protected\)\/frame\.default\.ts/);
    });

    test("親のルートの隣の frame.ts と、自分のルートの frame.default.ts / frame.ts は合格(0)", () => {
      const fork = makeFork(parentWithPages());
      write(fork, "src/app/(user)/(public)/news/frame.ts", "export const frame = { page: { fill: true } };\n");
      write(fork, "src/app/(user)/(protected)/frame.ts", "export const frame = { layout: {} };\n");
      write(fork, "src/app/(user)/(public)/mine/page.tsx", "export default 1;\n");
      write(fork, "src/app/(user)/(public)/mine/frame.default.ts", "export const frameDefault = { page: {} };\n");
      commitAll(fork, "frames ok");
      const result = runCheck(fork);
      assert.equal(result.status, "pass", JSON.stringify(result.entries.filter((e) => e.verdict === "violation")));
    });
  });

  test("受け口の行は生成区画(宣言から): core の受け口の印なしの項目と core の 1 行スイッチの .replace は合格、受け口の外の core への追加は core-add", () => {
    const parent = makeParent();
    const intakePath = "src/lib/forkOwnership/intake.txt";
    write(parent, intakePath, `${readFileSync(join(parent, intakePath), "utf8")}# === AUTO-GENERATED intake START ===\n# === AUTO-GENERATED intake END ===\n`);
    write(parent, "src/features/core/user/extensionPoints.ts", 'export const extensionPoints = { cleanupHandlers: { dir: "cleanupHandlers", export: "handler", type: { from: "@/t", name: "T" }, side: "server" } };\n');
    write(parent, "src/features/core/user/cleanupHandlers/base.ts", "export const handler = 1;\n");
    write(parent, "src/features/core/payment/enricher.default.ts", "export function enrich() {}\n");
    write(parent, "src/features/core/payment/enricher.ts", 'export { enrich } from "./enricher.default";\n');
    // 生成区画は実物の生成器(pnpm extensions:generate の中身)で書く
    const plan = planExtensions(parent);
    assert.deepEqual(plan.problems, []);
    write(parent, intakePath, plan.intake.content);
    assert.match(plan.intake.content, /^add src\/features\/core\/user\/cleanupHandlers\/\*\.\{ts,tsx\}/m);
    assert.match(plan.intake.content, /^add src\/features\/core\/payment\/enricher\.replace\.\{ts,tsx\}/m);
    commitAll(parent, "receptacles");

    const fork = makeFork(parent);
    write(fork, "src/features/core/user/cleanupHandlers/mine.ts", "export const handler = 2;\n");
    write(fork, "src/features/core/user/cleanupHandlers/folder/index.ts", "export const handler = 3;\n");
    write(fork, "src/features/core/payment/enricher.replace.ts", "export function enrich() {}\n");
    write(fork, "src/features/core/payment/enricher.ts", 'export { enrich } from "./enricher.replace";\n');
    commitAll(fork, "plain items");
    let result = runCheck(fork);
    const reasonOf = (path) => result.entries.find((entry) => entry.path === path)?.reason;
    assert.equal(reasonOf("src/features/core/user/cleanupHandlers/mine.ts"), "added");
    assert.equal(reasonOf("src/features/core/user/cleanupHandlers/folder/index.ts"), "added");
    assert.equal(reasonOf("src/features/core/payment/enricher.replace.ts"), "added");
    assert.equal(reasonOf("src/features/core/payment/enricher.ts"), "outside-intake", "スイッチの書き換えは手書きの edit の行(この fixture には無い)");

    write(fork, "src/features/core/payment/enricher.ts", 'export { enrich } from "./enricher.default";\n');
    write(fork, "src/features/core/user/helper.ts", "export const x = 1;\n");
    commitAll(fork, "outside");
    result = runCheck(fork);
    assert.equal(reasonOf("src/features/core/user/helper.ts"), "core-add");
    assert.equal(reasonOf("src/features/core/user/cleanupHandlers/mine.ts"), "added");
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

  test("core への追加は core-add で違反(Tier1 の版に無いファイルでも中間 Tier の物にしない)、一時許可で通る", () => {
    const fork = makeFork(makeParent());
    write(fork, "src/features/core/user/mine.ts", "export const mine = 1;\n");
    commitAll(fork, "core add");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    const entry = result.entries.find((item) => item.path === "src/features/core/user/mine.ts");
    assert.equal(entry.reason, "core-add");
    const line = entry.permitDraft.replace("<依頼の番号>", "20261029-120000-core-add").replace("<理由>", "移すまで");
    write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${line}\n`);
    commitAll(fork, "permit");
    assert.equal(runCheck(fork).status, "pass");
  });

  test("門番への受け口の外の追加は gate-add で違反(中間 Tier の物にしない)、受け口の項目は合格", () => {
    const parent = makeParent();
    write(parent, "src/featureGate/index.ts", "export const gate = {};\n");
    write(parent, "src/lib/forkOwnership/intake.txt", "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nedit .claude/rules/project.md  # fork の名前の宣言\nadd src/featureGate/rules/*.{ts,tsx}  # 受け口 rules\n");
    commitAll(parent, "gate");
    const fork = makeFork(parent);
    write(fork, "src/featureGate/mine.ts", "export const mine = 1;\n");
    write(fork, "src/featureGate/rules/mine.ts", "export const rule = {};\n");
    commitAll(fork, "gate add");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.equal(result.entries.find((item) => item.path === "src/featureGate/mine.ts").reason, "gate-add");
    assert.equal(result.entries.find((item) => item.path === "src/featureGate/rules/mine.ts").reason, "added");
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

  /** 下の Tier を作る: 親を clone、名前の宣言と、取り込んだ親の版を upstream: に書いた台帳 */
  const makeTier = (upper, name) => {
    const root = join(tmp, `${name}-${(counter += 1)}`);
    git(tmp, "clone", "-q", upper, root);
    git(root, "remote", "rename", "origin", "upstream");
    git(root, "remote", "add", "origin", `git@github.com:acme/${name}.git`);
    write(root, ".claude/rules/project.md", `## TIER\nfork_id: ${name}\n`);
    write(root, `.notices/applied/${name}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${git(root, "rev-parse", "upstream/main").trim()} | notes:-\n`);
    commitAll(root, `${name} start`);
    return root;
  };

  test("多段(D29/D34): 台帳の upstream: を .notices/applied/ の無い版までたどり、中間 Tier の物の書き換え・削除は合格(参考)", () => {
    const tier1 = makeParent();
    const tier2 = makeFork(tier1); // game.ts を足した中間 Tier(名前 child)
    write(tier2, "src/features/game/rules.ts", "export const rules = 1;\n");
    commitAll(tier2, "tier2 more");
    const tier1Sha = git(tier2, "rev-parse", "upstream/main").trim();

    const tier3 = makeTier(tier2, "grandchild");
    write(tier3, "src/features/game/game.ts", "export const game = 3;\n"); // 中間 Tier の物の書き換え
    git(tier3, "rm", "-q", "src/features/game/rules.ts"); // 中間 Tier の物の削除
    commitAll(tier3, "tier3");
    const ok = runCheck(tier3);
    assert.equal(ok.status, "pass", JSON.stringify(ok.entries?.filter((e) => e.verdict === "violation")));
    assert.equal(ok.tier1.sha, tier1Sha);
    assert.deepEqual(ok.tier1.chain.map((step) => step.name), [FORK_ID]);
    assert.deepEqual(ok.middleTier.map((m) => `${m.was}:${m.path}`).sort(), ["deleted:src/features/game/rules.ts", "outside-intake:src/features/game/game.ts"]);

    // Tier1 の物は今どおり厳密
    write(tier3, "src/features/core/user/user.ts", "export const user = 3;\n");
    commitAll(tier3, "tier1 file");
    const ng = runCheck(tier3);
    assert.equal(ng.status, "fail");
    assert.equal(ng.entries.find((e) => e.path === "src/features/core/user/user.ts").reason, "outside-intake");
  });

  test("多段: 4 段目も Tier1 の版を取り違えない(Tier2・Tier3 の物は合格、Tier1 の物は違反)", () => {
    const tier1 = makeParent();
    const tier1Sha = git(tier1, "rev-parse", "HEAD").trim();
    const tier2 = makeFork(tier1);
    const tier3 = makeTier(tier2, "third");
    write(tier3, "src/features/shop/shop.ts", "export const shop = 1;\n");
    commitAll(tier3, "tier3 adds");
    const tier4 = makeTier(tier3, "fourth");
    write(tier4, "src/features/game/game.ts", "export const game = 4;\n"); // Tier2 の物
    git(tier4, "rm", "-q", "src/features/shop/shop.ts"); // Tier3 の物
    commitAll(tier4, "tier4");
    const ok = runCheck(tier4);
    assert.equal(ok.status, "pass", JSON.stringify(ok.entries?.filter((e) => e.verdict === "violation")));
    assert.equal(ok.tier1.sha, tier1Sha);
    assert.deepEqual(ok.tier1.chain.map((step) => step.name), ["third", FORK_ID]);
    assert.deepEqual(ok.middleTier.map((m) => m.path).sort(), ["src/features/game/game.ts", "src/features/shop/shop.ts"]);

    write(tier4, "src/features/core/user/user.ts", "export const user = 4;\n");
    commitAll(tier4, "tier1 file");
    assert.equal(runCheck(tier4).status, "fail");
  });

  test("多段: 親の上書き(override)を下の Tier が消す・空にするのは合格(Tier1 は override を出荷しない = 中間 Tier の物、D34 K1)", () => {
    const tier2 = makeFork(makeParent());
    write(tier2, "src/app/api/cron/a/override.ts", "export const cronOverride = { disabled: true };\n");
    write(tier2, "src/features/core/user/services/server/domainEntry.override.ts", "export const domainEntryOverrides = {};\n");
    commitAll(tier2, "tier2 overrides");
    const tier3 = makeTier(tier2, "grandchild");
    write(tier3, "src/app/api/cron/a/override.ts", "");
    git(tier3, "rm", "-q", "src/features/core/user/services/server/domainEntry.override.ts");
    commitAll(tier3, "tier3 drops overrides");
    const result = runCheck(tier3);
    assert.equal(result.status, "pass", JSON.stringify(result.entries?.filter((e) => e.verdict === "violation")));
    assert.equal(result.middleTier.length, 2);
  });

  test("多段: upstream: が無い・その sha が辿れない・途中の版に fork_id: / 台帳が無い → 未検証(2)", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(fork, `.notices/applied/${FORK_ID}.md`, "# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | notes:-\n");
    commitAll(fork, "no field");
    assert.match(runCheck(fork).reason, /upstream:<sha> の行が無い/);
    assert.equal(cli(fork).status, 2);

    write(fork, `.notices/applied/${FORK_ID}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${"0".repeat(40)} | notes:-\n`);
    commitAll(fork, "bad sha");
    assert.match(runCheck(fork).reason, /履歴に無い/);

    // 中間 Tier の版に fork_id: が無い
    const tier2 = makeFork(makeParent());
    write(tier2, ".claude/rules/project.md", "## TIER\n");
    commitAll(tier2, "drop name");
    const tier3 = makeTier(tier2, "grandchild");
    assert.match(runCheck(tier3).reason, /fork_id: が無い/);

    // 中間 Tier の版の台帳が fork_id: の名前でない(改名前の名前のまま)
    const tier2b = makeFork(makeParent());
    git(tier2b, "mv", `.notices/applied/${FORK_ID}.md`, ".notices/applied/old-child.md");
    commitAll(tier2b, "old ledger name");
    const tier3b = makeTier(tier2b, "grandchild");
    assert.match(runCheck(tier3b).reason, /が無い\(台帳の名前を fork_id: にそろえる\)/);
  });

  test("--json は結果のオブジェクトをそのまま出す", () => {
    const fork = makeFork(makeParent());
    const out = cli(fork, "--json");
    assert.equal(out.status, 0);
    assert.equal(JSON.parse(out.stdout).status, "pass");
    assert.equal(cli(fork, "--bogus").status, 2);
  });

  describe("索引 .notices/shipped/ から読む(本文が消えても判定が変わらない)", () => {
    const ROW_RESOLVE = "- id:20261029-130000-user-hook-intake | severity:info | checkpoint:user-hook-intake | resolves:20261029-120000-user-hook";
    const ROW_NEW = "- id:20261029-000000-new | severity:info | checkpoint:new";

    /** 親に notice を本文 + 索引の行で出す(/ship と同じ 1 commit) */
    const ship = (parent, id, body, rows) => {
      write(parent, `.notices/${id}.md`, body);
      write(parent, `.notices/shipped/${PARENT_ID}.md`, `# SHIPPED ${PARENT_ID}\n\n${rows.join("\n")}\n`);
      commitAll(parent, `ship ${id}`);
    };
    const pull = (fork) => {
      git(fork, "fetch", "-q", "upstream");
      git(fork, "merge", "-q", "--no-edit", "upstream/main");
    };
    /** fork が一時許可を持つ状態(親の user.ts を外で変え、依頼 20261029-120000-user-hook の許可で通す) */
    const forkWithPermit = (parent) => {
      const fork = makeFork(parent);
      write(fork, "src/features/core/user/user.ts", "export const user = 2;\n");
      commitAll(fork, "outside");
      const draft = runCheck(fork).entries.find((entry) => entry.reason === "outside-intake").permitDraft;
      write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${draft.replace("<依頼の番号>", "20261029-120000-user-hook").replace("<理由>", "待ち")}\n`);
      commitAll(fork, "permit");
      return fork;
    };

    test("台帳に無い notice は索引の行からも数え、親が本文を消した後も同じ", () => {
      const parent = makeParent();
      const fork = makeFork(parent);
      ship(parent, "20261029-000000-new", "# DOWNSTREAM NOTICE id:20261029-000000-new\ncheckpoint: new\n", [ROW_NEW]);
      git(parent, "rm", "-q", ".notices/20261029-000000-new.md");
      commitAll(parent, "body removed after the segment closed");
      pull(fork);
      const result = runCheck(fork);
      assert.equal(result.status, "unverified");
      assert.deepEqual(result.unrecorded, ["20261029-000000-new"]);
      recordLedger(fork, "20261029-000000-new");
      commitAll(fork, "ledger");
      assert.equal(runCheck(fork).status, "pass");
    });

    test("fork 成立点の索引の行は継承済み(本文が無くても)", () => {
      const parent = makeParent();
      ship(parent, "20261029-000000-new", "# DOWNSTREAM NOTICE id:20261029-000000-new\n", [ROW_NEW]);
      git(parent, "rm", "-q", ".notices/20261029-000000-new.md");
      commitAll(parent, "body removed");
      const fork = makeFork(parent);
      assert.equal(runCheck(fork).status, "pass");
    });

    test("resolves: は索引の行から読み、本文を消した commit を取り込んでも一時許可は失効する", () => {
      const parent = makeParent();
      const fork = forkWithPermit(parent);
      assert.equal(runCheck(fork).status, "pass");
      ship(parent, "20261029-130000-user-hook-intake", "# DOWNSTREAM NOTICE id:20261029-130000-user-hook-intake\nresolves: 20261029-120000-user-hook\n", [ROW_RESOLVE]);
      git(parent, "rm", "-q", ".notices/20261029-130000-user-hook-intake.md");
      commitAll(parent, "body removed");
      pull(fork);
      recordLedger(fork, "20261029-130000-user-hook-intake");
      commitAll(fork, "ledger");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === "src/features/core/user/user.ts").permit, "expired-resolved");
    });

    test("索引の行だけにある resolves:(本文に無い)でも失効する = 索引が正", () => {
      const parent = makeParent();
      const fork = forkWithPermit(parent);
      ship(parent, "20261029-130000-user-hook-intake", "# DOWNSTREAM NOTICE id:20261029-130000-user-hook-intake\n", [ROW_RESOLVE]);
      pull(fork);
      recordLedger(fork, "20261029-130000-user-hook-intake");
      commitAll(fork, "ledger");
      assert.equal(runCheck(fork).entries.find((entry) => entry.path === "src/features/core/user/user.ts").permit, "expired-resolved");
    });
  });
});

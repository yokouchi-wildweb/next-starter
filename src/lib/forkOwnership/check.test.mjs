// 検査コマンド(check.mjs / cli.mjs)の検査。一時の git リポジトリ(親と fork)を os.tmpdir に作る(ネットワーク不要)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { forkAddedFiles, reassignMiddleTier, runCheck as runCheckWithSelf } from "./check.mjs";
import { closeTmp, commitAll, ENV, FORK_ID, git, LINEAGE_PREAMBLE, makeFork, makeParent, nextId, openTmp, PARENT_ID, recordLedger, repoJson, tmpRoot, write } from "./testRepos.mjs";

// 型 1〜4 の検査のテスト: 作り物のリポは self のファイルを持たないので、既定で入の型 5 self は外す(型 5 は self.test.mjs)
/** @import { CheckResult } from "./check.mjs" */
const runCheck = (/** @type {string} */ repoRoot, options = {}) => runCheckWithSelf(repoRoot, { self: false, ...options });

/** 検査が走った結果(pass / fail)。走らなければ失敗 */
const ran = (/** @type {CheckResult} */ result) => {
  if (result.status !== "pass" && result.status !== "fail") assert.fail(`検査が走っていない: ${JSON.stringify(result)}`);
  return result;
};
/** 未検証の結果。未検証でなければ失敗 */
const notVerified = (/** @type {CheckResult} */ result) => {
  if (result.status !== "unverified") assert.fail(`未検証でない: ${result.status}`);
  return result;
};
/** 合格を確かめる assert の説明に出す物(違反の一覧。検査が走っていなければ結果そのもの) */
const violationsOf = (/** @type {CheckResult} */ result) => ("entries" in result ? result.entries.filter((entry) => entry.verdict === "violation") : result);
/** 合格を確かめる assert の説明に出す物(lineage の結果。検査が走っていなければ結果そのもの) */
const lineageOf = (/** @type {CheckResult} */ result) => ("lineage" in result ? result.lineage : result);

// 走らせるのは pnpm workflow ownership check の入口(cli.mjs は読み込んだだけでは走らない。runOwnershipCheckCli を呼ぶ)
const CLI = resolve(import.meta.dirname, "../../../scripts/workflow/ownership/check.mjs");
// 台帳の行を足す道具(/flux が区間の commit の前に走らせる。src → scripts の import はしない: 子の node で走らせる)
const LEDGER_CLI = resolve(import.meta.dirname, "../../../scripts/workflow/notices/ledger.mjs");
const cli = (/** @type {string} */ cwd, /** @type {string[]} */ ...args) => spawnSync(process.execPath, [CLI, "--no-self", ...args], { cwd, env: ENV, encoding: "utf8" });

describe("pnpm workflow ownership check", () => {
  before(() => {
    openTmp();
  });
  after(() => {
    closeTmp();
  });

  describe("上流の版と同じ中身(D479: 基準・基準 + 台帳の picked:・基準から親の先端までの版)", () => {
    const CORE = "src/domains/core/user/multi.ts";
    const LINES = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
    const render = (/** @type {string[]} */ lines) => `${lines.join("\n")}\n`;

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
      const entry = result.entries.find((x) => x.path === CORE);
      assert.equal(entry?.reason, "upstream-version");
    });

    test("台帳に picked: が無ければ受け口の外の違反", () => {
      const { fork } = pickedFork({ record: false });
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === CORE)?.reason, "outside-intake");
    });

    test("衝突で上流の版に置き換えたファイル(pick の時点の上流と同じ中身)は合格(hotfixApply の置き換え)", () => {
      const { fork } = pickedFork();
      write(fork, CORE, render(["ONE", ...LINES.slice(1, 7), "EIGHT"]));
      commitAll(fork, "replaced by the upstream's version at the pick");
      const result = runCheck(fork);
      assert.equal(result.status, "pass");
      assert.equal(result.entries.find((entry) => entry.path === CORE)?.reason, "upstream-version");
    });

    test("pick が変えたファイルが上流のどれかの版(間の版)と同じ中身なら合格(hotfixApply が触っていないファイルを置き換えた形)", () => {
      const { fork } = pickedFork();
      write(fork, CORE, render(["ONE", ...LINES.slice(1)]));
      commitAll(fork, "the upstream's between version");
      const result = runCheck(fork);
      assert.equal(result.status, "pass");
      assert.equal(result.entries.find((entry) => entry.path === CORE)?.reason, "upstream-version");
    });

    test("pick の後に fork が更に変えたら違反", () => {
      const { fork } = pickedFork();
      write(fork, CORE, render(["one", "TWO", ...LINES.slice(2, 7), "EIGHT"]));
      commitAll(fork, "own edit");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === CORE)?.reason, "outside-intake");
    });

    test("pick が無くても、基準から親の先端までの版と同じ中身は合格 / 基準より古い版と同じ中身は違反", () => {
      const parent = makeParent();
      write(parent, CORE, render(["old", ...LINES.slice(1)]));
      commitAll(parent, "older");
      write(parent, CORE, render(LINES));
      commitAll(parent, "base version");
      const fork = makeFork(parent);
      write(parent, CORE, render(["LATER", ...LINES.slice(1)]));
      commitAll(parent, "later");
      git(fork, "fetch", "-q", "upstream");
      write(fork, CORE, render(["LATER", ...LINES.slice(1)]));
      commitAll(fork, "took the later upstream version by hand");
      const later = runCheck(fork);
      assert.equal(later.status, "pass");
      assert.equal(later.entries.find((entry) => entry.path === CORE)?.reason, "upstream-version", "親の先端までの版");
      write(fork, CORE, render(["old", ...LINES.slice(1)]));
      commitAll(fork, "the version older than the base");
      const older = runCheck(fork);
      assert.equal(older.status, "fail");
      assert.equal(older.entries.find((entry) => entry.path === CORE)?.reason, "outside-intake", "基準より古い版は数えない");
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
    write(fork, "src/domains/core/user/user.ts", "export const user = 2;\n");
    commitAll(fork, "edit upstream file");
    const result = forkAddedFiles(fork, { fetch: false });
    assert.equal(result.status, "ok");
    assert.equal(result.base, git(fork, "rev-parse", "upstream/main").trim());
    assert.deepEqual([...result.added].sort(), [`.notices/applied/${FORK_ID}.md`, "src/domains/game/game.ts"]);
    git(fork, "remote", "remove", "upstream");
    assert.equal(forkAddedFiles(fork, { fetch: false }).status, "unverified");
  });

  test("名前の宣言が無い・形違い → 未検証(2)。Tier1 は origin でなく repo_id と CATALOG の先頭の節で決まる", () => {
    const fork = makeFork(makeParent());
    write(fork, "repo.json", '{\n  "repo_id": "Bad_Name",\n  "tier": "middle"\n}\n');
    commitAll(fork, "bad name");
    const old = runCheck(fork);
    assert.equal(old.status, "unverified");
    assert.match(old.reason, /fork の名前/);
    assert.equal(cli(fork).status, 2);

    // origin が親と同じでも、名前が CATALOG の先頭の節と違えば Tier1 扱いにしない
    const parent = makeParent();
    write(parent, "repo.json", repoJson("someone-else", "root"));
    commitAll(parent, "rename");
    assert.notEqual(runCheck(parent).status, "tier1");
  });

  test("tier の誤り(知らない値・fork が root を名乗る)→ 未検証(2)。repo.json が無い → 未検証(2)", () => {
    const fork = makeFork(makeParent());
    write(fork, "repo.json", repoJson(FORK_ID, "maybe"));
    commitAll(fork, "bad tier");
    const bad = runCheck(fork);
    assert.equal(bad.status, "unverified");
    assert.match(bad.reason, /使えない値/);
    assert.equal(cli(fork).status, 2);
    write(fork, "repo.json", repoJson(FORK_ID, "root"));
    commitAll(fork, "fake root");
    assert.match(notVerified(runCheck(fork)).reason, /tier root なのに/);
    git(fork, "rm", "-q", "repo.json");
    commitAll(fork, "no repo.json");
    const none = runCheck(fork);
    assert.equal(none.status, "unverified");
    assert.match(JSON.stringify(none), /repo\.json が無い/);
  });

  describe("単位名の同名(unit-clash)と自分の項目への override(override-own)", () => {
    /** 受け口・wiring・route の隣・scripts の項目を持つ親 */
    function parentWithPlaces() {
      const parent = makeParent();
      write(parent, "src/lib/forkOwnership/intake.txt", `${readFileSync(join(parent, "src/lib/forkOwnership/intake.txt"), "utf8")}edit src/domains/core/setting/fields/**  # 受け口\n`);
      write(parent, "src/domains/core/setting/extensionPoints.ts", 'export const extensionPoints = { fields: { change: "add", dir: "fields", export: "field", type: { from: "@/t", name: "T" }, side: "server" } };\n');
      write(parent, "src/domains/core/setting/fields/a.ts", "export const field = 1;\n");
      write(parent, "src/wiring/apiRoute.ts", "export const x = 1;\n");
      write(parent, "src/wiring/oldBundle/index.ts", "export const x = 1;\n");
      write(parent, "src/app/(user)/_layout/Header/index.tsx", "export const Header = 1;\n");
      commitAll(parent, "places");
      return parent;
    }

    test("同じ単位の追加(.ts と .tsx・ファイルとフォルダ、受け口・wiring・route の隣)と自分の項目への override は違反(1)", () => {
      const fork = makeFork(parentWithPlaces());
      write(fork, "src/domains/core/setting/fields/a.tsx", "export const field = 2;\n");
      write(fork, "src/wiring/apiRoute.tsx", "export const x = 2;\n");
      write(fork, "src/wiring/oldBundle.ts", "export const x = 2;\n");
      write(fork, "src/app/(user)/_layout/Header.tsx", "export const Header = 2;\n");
      write(fork, "src/domains/core/setting/fields/mine.ts", "export const field = 3;\n");
      write(fork, "src/domains/core/setting/fields/mine.override.ts", "export const override = {};\n");
      commitAll(fork, "clash");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      const reasonOf = (/** @type {string} */ path) => result.entries.find((entry) => entry.path === path)?.reason;
      for (const path of ["src/domains/core/setting/fields/a.tsx", "src/wiring/apiRoute.tsx", "src/wiring/oldBundle.ts", "src/app/(user)/_layout/Header.tsx"]) {
        assert.equal(reasonOf(path), "unit-clash", path);
      }
      assert.equal(result.entries.find((entry) => entry.path === "src/wiring/oldBundle.ts")?.clash, "src/wiring/oldBundle/index.ts");
      assert.equal(reasonOf("src/domains/core/setting/fields/mine.override.ts"), "override-own");
      assert.equal(reasonOf("src/domains/core/setting/fields/mine.ts"), "added");
      assert.deepEqual(result.middleTier, []);
      const out = cli(fork);
      assert.equal(out.status, 1);
      assert.match(out.stdout, /\[unit-clash\] src\/wiring\/oldBundle\.ts\(基準の src\/wiring\/oldBundle\/index\.ts と同じ単位\)/);
    });

    test("正しい形(印なしの新しい名前・.replace・上流の項目への override)は合格(0)", () => {
      const fork = makeFork(parentWithPlaces());
      write(fork, "src/domains/core/setting/fields/mine.ts", "export const field = 3;\n");
      write(fork, "src/domains/core/setting/fields/a.override.ts", "export const override = {};\n");
      write(fork, "src/wiring/mine.ts", "export const x = 2;\n");
      write(fork, "src/app/(user)/_layout/Header.replace.tsx", "export const Header = 2;\n");
      write(fork, "src/domains/shop/scripts/tasks/mine.ts", "export const task = 2;\n");
      commitAll(fork, "plain");
      const result = runCheck(fork);
      assert.equal(result.status, "pass", JSON.stringify(violationsOf(result)));
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
      const reasonOf = (/** @type {string} */ path) => result.entries.find((entry) => entry.path === path)?.reason;
      assert.equal(reasonOf("src/app/(user)/(protected)/frame.default.ts"), "default-add");
      assert.equal(reasonOf("src/app/(user)/(public)/news/frame.default.ts"), "default-edit");
      assert.deepEqual(result.middleTier, []);
      const out = cli(fork);
      assert.equal(out.status, 1);
      assert.match(out.stdout, /\[default-add\] src\/app\/\(user\)\/\(protected\)\/frame\.default\.ts/);
    });

    test("親のルートの隣の frame.override.ts と、自分のルートの frame.ts は合格(0)", () => {
      const fork = makeFork(parentWithPages());
      write(fork, "src/app/(user)/(public)/news/frame.override.ts", "export const override = { page: { fill: true } };\n");
      write(fork, "src/app/(user)/(protected)/frame.override.ts", "export const override = { layout: {} };\n");
      write(fork, "src/app/(user)/(public)/mine/page.tsx", "export default 1;\n");
      write(fork, "src/app/(user)/(public)/mine/frame.ts", "export const frame = { page: {} };\n");
      commitAll(fork, "frames ok");
      const result = runCheck(fork);
      assert.equal(result.status, "pass", JSON.stringify(violationsOf(result)));
    });

    test("親のルートの隣に足した印なしの frame.ts は frame-plain(1)、中間 Tier の物にしない", () => {
      const fork = makeFork(parentWithPages());
      write(fork, "src/app/(user)/(protected)/frame.ts", "export const frame = { layout: {} };\n");
      commitAll(fork, "plain frame");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === "src/app/(user)/(protected)/frame.ts")?.reason, "frame-plain");
      assert.deepEqual(result.middleTier, []);
      assert.match(cli(fork).stdout, /\[frame-plain\] src\/app\/\(user\)\/\(protected\)\/frame\.ts/);
    });
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
    write(fork, "src/domains/core/user/user.ts", "export const user = 2;\n");
    write(fork, "src/lib/crud/extra.ts", "export const extra = 1;\n");
    rmSync(join(fork, ".notices/20260101-000000-inherited.md"));
    commitAll(fork, "outside");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.deepEqual(
      result.entries.filter((entry) => entry.verdict === "violation").map((entry) => [entry.path, entry.reason]).sort(),
      [
        [".notices/20260101-000000-inherited.md", "deleted"],
        ["src/domains/core/user/user.ts", "outside-intake"],
        ["src/lib/crud/extra.ts", "inside-unit-add"],
      ],
    );
    const draft = result.entries.find((entry) => entry.reason === "outside-intake")?.permitDraft ?? "";
    assert.match(draft, /^src\/domains\/core\/user\/user\.ts upreq:<依頼の番号> base:[0-9a-f]{40} head:[0-9a-f]{40}  # <理由>$/);
    const out = cli(fork);
    assert.equal(out.status, 1);
    assert.match(out.stdout, /違反 3 件/);
  });

  test("core への追加は core-add で違反(Tier1 の版に無いファイルでも中間 Tier の物にしない)、一時許可で通る", () => {
    const fork = makeFork(makeParent());
    write(fork, "src/domains/core/user/mine.ts", "export const mine = 1;\n");
    commitAll(fork, "core add");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    const entry = result.entries.find((item) => item.path === "src/domains/core/user/mine.ts");
    assert.ok(entry);
    assert.equal(entry.reason, "core-add");
    const line = (entry.permitDraft ?? "").replace("<依頼の番号>", "20261029-120000-core-add").replace("<理由>", "移すまで");
    write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${line}\n`);
    commitAll(fork, "permit");
    assert.equal(runCheck(fork).status, "pass");
  });

  test("門番への受け口の外の追加は gate-add で違反(中間 Tier の物にしない)、受け口の項目は合格", () => {
    const parent = makeParent();
    write(parent, "src/featureGate/index.ts", "export const gate = {};\n");
    write(parent, "src/lib/forkOwnership/intake.txt", "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nedit .claude/rules/project.md  # 概要\nedit repo.json  # 名前と段\nadd src/featureGate/rules/*.{ts,tsx}  # 受け口 rules\n");
    commitAll(parent, "gate");
    const fork = makeFork(parent);
    write(fork, "src/featureGate/mine.ts", "export const mine = 1;\n");
    write(fork, "src/featureGate/rules/mine.ts", "export const rule = {};\n");
    commitAll(fork, "gate add");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.equal(result.entries.find((item) => item.path === "src/featureGate/mine.ts")?.reason, "gate-add");
    assert.equal(result.entries.find((item) => item.path === "src/featureGate/rules/mine.ts")?.reason, "added");
  });

  test("上流の決まりのファイル .claude/rules/core/ への追加は rules-core-add で違反(中間 Tier の物にしない)、自分の札は合格", () => {
    const parent = makeParent();
    write(parent, ".claude/rules/core/design.md", "---\npaths:\n  - \"CLAUDE.md\"\n---\n# design\n");
    write(parent, "src/lib/forkOwnership/intake.txt", "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nedit .claude/rules/project.md  # 概要\nedit repo.json  # 名前と段\nadd .claude/rules/items/**  # 札\n");
    commitAll(parent, "rules core");
    const fork = makeFork(parent);
    write(fork, ".claude/rules/core/mine.md", "# mine\n");
    write(fork, ".claude/rules/items/lib/mine.md", "# lib/mine\n");
    commitAll(fork, "rules add");
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.equal(result.entries.find((item) => item.path === ".claude/rules/core/mine.md")?.reason, "rules-core-add");
    assert.equal(result.entries.find((item) => item.path === ".claude/rules/items/lib/mine.md")?.reason, "added");
  });

  test("下書きの指紋で一時許可を書けば合格(permitted)、その後に書き換えると許可し直し", () => {
    const fork = makeFork(makeParent());
    write(fork, "src/domains/core/user/user.ts", "export const user = 2;\n");
    commitAll(fork, "outside");
    const draft = ran(runCheck(fork)).entries.find((entry) => entry.reason === "outside-intake")?.permitDraft ?? "";
    const line = draft.replace("<依頼の番号>", "20261029-120000-user-hook").replace("<理由>", "フック待ち");
    write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${line}\n`);
    commitAll(fork, "permit");
    const permitted = runCheck(fork);
    assert.equal(permitted.status, "pass");
    assert.equal(permitted.counts.permitted, 1);

    write(fork, "src/domains/core/user/user.ts", "export const user = 3;\n");
    commitAll(fork, "edit again");
    const refreshed = runCheck(fork);
    assert.equal(refreshed.status, "fail");
    assert.equal(refreshed.entries.find((entry) => entry.path === "src/domains/core/user/user.ts")?.permit, "refresh");
  });

  test("親が resolves: でその依頼を解決した notice を出すと、取り込んだ fork の一時許可が失効する", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(fork, "src/domains/core/user/user.ts", "export const user = 2;\n");
    commitAll(fork, "outside");
    const draft = ran(runCheck(fork)).entries.find((entry) => entry.reason === "outside-intake")?.permitDraft ?? "";
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
    assert.equal(result.entries.find((entry) => entry.path === "src/domains/core/user/user.ts")?.permit, "expired-resolved");
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
    assert.match(notVerified(runCheck(fork)).reason, /決まらない/);
    assert.equal(runCheck(fork, { parent: "upstream" }).status, "pass");
  });

  test("親を取得できない → 未検証", () => {
    const fork = makeFork(makeParent());
    git(fork, "remote", "set-url", "upstream", join(tmpRoot(), "missing"));
    const result = runCheck(fork, { branch: "main" });
    assert.equal(result.status, "unverified");
    assert.match(result.reason, /取得できない/);
  });

  test("基準に受け口の一覧が無い(この検査を取り込む前)→ 未検証", () => {
    const fork = makeFork(makeParent({ withIntake: false }));
    assert.match(notVerified(runCheck(fork)).reason, /intake\.txt が無い/);
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

  test("notice の無い末尾の区間の台帳の行(tail-<sha>、pnpm workflow notices ledger --tail): 合格、Tier1 の版 = その upstream:", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(parent, ".notices/20261124-000000-last.md", "# DOWNSTREAM NOTICE id:20261124-000000-last\n");
    commitAll(parent, "last notice");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-edit", "upstream/main");
    recordLedger(fork, "20261124-000000-last");
    commitAll(fork, "segment");
    write(parent, "src/lib/crud/index.ts", "export const crud = 2;\n");
    commitAll(parent, "tail: no notice");
    const tail = git(parent, "rev-parse", "HEAD").trim();
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-edit", "upstream/main");
    const ledger = spawnSync(process.execPath, [LEDGER_CLI, "--upstream=upstream/main", "--tail"], { cwd: fork, env: ENV, encoding: "utf8" });
    assert.equal(ledger.status, 0, ledger.stdout + ledger.stderr);
    assert.match(readFileSync(join(fork, `.notices/applied/${FORK_ID}.md`), "utf8"), new RegExp(`^- id:tail-${tail.slice(0, 9)} \\|.*upstream:${tail} \\| relay:none`, "m"));
    commitAll(fork, "tail segment");
    const result = ran(runCheck(fork));
    assert.equal(result.status, "pass", JSON.stringify(violationsOf(result)));
    assert.equal(result.tier1.sha, tail);
  });

  /** 下の Tier を作る: 親を clone、名前の宣言と、取り込んだ親の版を upstream: に書いた台帳 */
  const makeTier = (/** @type {string} */ upper, /** @type {string} */ name) => {
    const root = join(tmpRoot(), `${name}-${nextId()}`);
    git(tmpRoot(), "clone", "-q", upper, root);
    git(root, "remote", "rename", "origin", "upstream");
    git(root, "remote", "add", "origin", `git@github.com:acme/${name}.git`);
    write(root, "repo.json", repoJson(name, "middle"));
    write(root, `.notices/applied/${name}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${git(root, "rev-parse", "upstream/main").trim()} | notes:-\n`);
    commitAll(root, `${name} start`);
    return root;
  };

  test("多段(D29/D34): 台帳の upstream: を .notices/applied/ の無い版までたどり、中間 Tier の物の書き換え・削除は合格(参考)", () => {
    const tier1 = makeParent();
    const tier2 = makeFork(tier1); // game.ts を足した中間 Tier(名前 child)
    write(tier2, "src/domains/game/rules.ts", "export const rules = 1;\n");
    commitAll(tier2, "tier2 more");
    const tier1Sha = git(tier2, "rev-parse", "upstream/main").trim();

    const tier3 = makeTier(tier2, "grandchild");
    write(tier3, "src/domains/game/game.ts", "export const game = 3;\n"); // 中間 Tier の物の書き換え
    git(tier3, "rm", "-q", "src/domains/game/rules.ts"); // 中間 Tier の物の削除
    commitAll(tier3, "tier3");
    const ok = runCheck(tier3);
    assert.equal(ok.status, "pass", JSON.stringify(violationsOf(ok)));
    assert.equal(ok.tier1.sha, tier1Sha);
    assert.deepEqual(ok.tier1.chain.map((step) => step.name), [FORK_ID]);
    assert.deepEqual(ok.middleTier.map((m) => `${m.was}:${m.path}`).sort(), ["deleted:src/domains/game/rules.ts", "outside-intake:src/domains/game/game.ts"]);

    // Tier1 の物は今どおり厳密
    write(tier3, "src/domains/core/user/user.ts", "export const user = 3;\n");
    commitAll(tier3, "tier1 file");
    const ng = runCheck(tier3);
    assert.equal(ng.status, "fail");
    assert.equal(ng.entries.find((e) => e.path === "src/domains/core/user/user.ts")?.reason, "outside-intake");
  });

  test("多段: 中間 Tier が足した .claude/rules/service/ の物は下流で書き換え・削除できない(付け替えない、D117)、自分の service は足してよい", () => {
    const tier1 = makeParent();
    write(tier1, "src/lib/forkOwnership/intake.txt", "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nedit .claude/rules/project.md  # 概要\nedit repo.json  # 名前と段\nadd .claude/rules/service/**  # 業務の全体像\n");
    commitAll(tier1, "service intake");
    const tier2 = makeFork(tier1);
    write(tier2, ".claude/rules/service/shop.md", "# shop\n");
    commitAll(tier2, "tier2 service");
    const tier3 = makeTier(tier2, "grandchild");
    write(tier3, ".claude/rules/service/shop.md", "# shop changed\n");
    write(tier3, ".claude/rules/service/rental.md", "# rental\n");
    commitAll(tier3, "tier3 service");
    const result = runCheck(tier3);
    assert.equal(result.status, "fail");
    assert.equal(result.entries.find((e) => e.path === ".claude/rules/service/shop.md")?.verdict, "violation");
    assert.equal(result.entries.find((e) => e.path === ".claude/rules/service/rental.md")?.reason, "added");
    assert.ok(!result.middleTier.some((m) => m.path === ".claude/rules/service/shop.md"));
  });

  test("多段: lineage.md の節(中間層の節・同じ鍵を (priority) で書く下の段は合格、並び違い・none で自分の節は違反)", () => {
    const tier1 = makeParent({ withLineage: true });
    const tier2 = makeFork(tier1);
    const lineage = ".claude/rules/lineage.md";
    write(tier2, lineage, `${LINEAGE_PREAMBLE}## ${FORK_ID}\n- relay: always\n- tone: polite\n<!-- end ${FORK_ID} -->\n`);
    commitAll(tier2, "tier2 section");
    const tier2Result = runCheck(tier2);
    assert.equal(tier2Result.status, "pass", JSON.stringify(lineageOf(tier2Result)));
    assert.equal(tier2Result.lineage.checked, true);

    const tier3 = makeTier(tier2, "grandchild");
    const project = `## TIER\n`;
    write(tier3, ".claude/rules/project.md", `${project}- tone (priority): casual\n`);
    commitAll(tier3, "change a key by the mark");
    const ok = runCheck(tier3);
    assert.equal(ok.status, "pass", JSON.stringify(lineageOf(ok)));

    // 自分の節の後ろに祖先の節をもう一度(追記なので append は通るが、並びが違う)
    write(tier3, ".claude/rules/project.md", project);
    write(tier3, lineage, `${readFileSync(join(tier3, lineage), "utf8")}## grandchild\n- own: 1\n<!-- end grandchild -->\n## ${FORK_ID}\n<!-- end ${FORK_ID} -->\n`);
    commitAll(tier3, "bad order");
    const badOrder = ran(runCheck(tier3));
    assert.equal(badOrder.status, "fail");
    assert.match(badOrder.lineage.failures.join(), /並びが違う/);
    assert.equal(badOrder.counts.lineage, 1);
    const printed = cli(tier3);
    assert.equal(printed.status, 1);
    assert.match(printed.stdout, /中間層の規則の誤り/);

    // 末端(tier leaf)なのに自分の節
    write(tier3, lineage, `${LINEAGE_PREAMBLE}## ${FORK_ID}\n- relay: always\n- tone: polite\n<!-- end ${FORK_ID} -->\n## grandchild\n- own: 1\n<!-- end grandchild -->\n`);
    write(tier3, "repo.json", repoJson("grandchild", "leaf"));
    commitAll(tier3, "leaf with section");
    const leaf = runCheck(tier3);
    assert.equal(leaf.status, "fail");
    assert.match(leaf.lineage.failures.join(), /tier leaf/);
  });

  test("lineage.md の無い fork(取り込む前)は lineage を検査しない", () => {
    const fork = makeFork(makeParent());
    const result = runCheck(fork);
    assert.equal(result.status, "pass");
    assert.equal(result.lineage.checked, false);
  });

  test("多段: 4 段目も Tier1 の版を取り違えない(Tier2・Tier3 の物は合格、Tier1 の物は違反)", () => {
    const tier1 = makeParent();
    const tier1Sha = git(tier1, "rev-parse", "HEAD").trim();
    const tier2 = makeFork(tier1);
    const tier3 = makeTier(tier2, "third");
    write(tier3, "src/domains/shop/shop.ts", "export const shop = 1;\n");
    commitAll(tier3, "tier3 adds");
    const tier4 = makeTier(tier3, "fourth");
    write(tier4, "src/domains/game/game.ts", "export const game = 4;\n"); // Tier2 の物
    git(tier4, "rm", "-q", "src/domains/shop/shop.ts"); // Tier3 の物
    commitAll(tier4, "tier4");
    const ok = runCheck(tier4);
    assert.equal(ok.status, "pass", JSON.stringify(violationsOf(ok)));
    assert.equal(ok.tier1.sha, tier1Sha);
    assert.deepEqual(ok.tier1.chain.map((step) => step.name), ["third", FORK_ID]);
    assert.deepEqual(ok.middleTier.map((m) => m.path).sort(), ["src/domains/game/game.ts", "src/domains/shop/shop.ts"]);

    write(tier4, "src/domains/core/user/user.ts", "export const user = 4;\n");
    commitAll(tier4, "tier1 file");
    assert.equal(runCheck(tier4).status, "fail");
  });

  test("多段: 親の上書き(override)を下の Tier が消す・空にするのは合格(Tier1 は override を出荷しない = 中間 Tier の物、D34 K1)", () => {
    const tier2 = makeFork(makeParent());
    write(tier2, "src/app/api/cron/a/task.override.ts", "export const cronOverride = { disabled: true };\n");
    write(tier2, "src/domains/core/user/services/server/domainEntry.override.ts", "export const domainEntryOverrides = {};\n");
    commitAll(tier2, "tier2 overrides");
    const tier3 = makeTier(tier2, "grandchild");
    write(tier3, "src/app/api/cron/a/task.override.ts", "");
    git(tier3, "rm", "-q", "src/domains/core/user/services/server/domainEntry.override.ts");
    commitAll(tier3, "tier3 drops overrides");
    const result = runCheck(tier3);
    assert.equal(result.status, "pass", JSON.stringify(violationsOf(result)));
    assert.equal(result.middleTier.length, 2);
  });

  test("多段: upstream: が無い・その sha が辿れない・途中の版に名前 / 台帳が無い → 未検証(2)。古い形の中間 Tier の版は読める", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    write(fork, `.notices/applied/${FORK_ID}.md`, "# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | notes:-\n");
    commitAll(fork, "no field");
    assert.match(notVerified(runCheck(fork)).reason, /upstream:<sha> の行が無い/);
    assert.equal(cli(fork).status, 2);

    write(fork, `.notices/applied/${FORK_ID}.md`, `# APPLIED LEDGER\n- id:fork-init | date:x | commit:- | upstream:${"0".repeat(40)} | notes:-\n`);
    commitAll(fork, "bad sha");
    assert.match(notVerified(runCheck(fork)).reason, /履歴に無い/);

    // 中間 Tier の版に名前が無い
    const tier2 = makeFork(makeParent());
    write(tier2, "repo.json", '{\n  "tier": "middle"\n}\n');
    commitAll(tier2, "drop name");
    const tier3 = makeTier(tier2, "grandchild");
    assert.match(notVerified(runCheck(tier3)).reason, /repo_id\(古い形は .claude\/rules\/project.md の fork_id:\)が無い/);

    // 古い形の中間 Tier の版(repo.json が無く project.md の fork_id:)は読める
    const tier2old = makeFork(makeParent());
    git(tier2old, "rm", "-q", "repo.json");
    write(tier2old, ".claude/rules/project.md", `## TIER\nfork_id: ${FORK_ID}\ndownstream: yes\n`);
    commitAll(tier2old, "old form");
    const tier3old = makeTier(tier2old, "grandchild");
    assert.notEqual(runCheck(tier3old).status, "unverified", JSON.stringify(runCheck(tier3old)));

    // 中間 Tier の版の台帳が fork_id: の名前でない(改名前の名前のまま)
    const tier2b = makeFork(makeParent());
    git(tier2b, "mv", `.notices/applied/${FORK_ID}.md`, ".notices/applied/old-child.md");
    commitAll(tier2b, "old ledger name");
    const tier3b = makeTier(tier2b, "grandchild");
    assert.match(notVerified(runCheck(tier3b)).reason, /が無い\(台帳の名前を repo_id にそろえる\)/);
  });

  test("--json は結果のオブジェクトをそのまま出す", () => {
    const fork = makeFork(makeParent());
    const out = cli(fork, "--json");
    assert.equal(out.status, 0);
    assert.equal(JSON.parse(out.stdout).status, "pass");
    assert.equal(cli(fork, "--bogus").status, 2);
  });

  describe("出荷済みの notice は履歴から読む(本文が消えても判定が変わらない、D350)", () => {
    /** 親に notice の本文を出す */
    const ship = (/** @type {string} */ parent, /** @type {string} */ id, /** @type {string} */ body) => {
      write(parent, `.notices/${id}.md`, body);
      commitAll(parent, `ship ${id}`);
    };
    const pull = (/** @type {string} */ fork) => {
      git(fork, "fetch", "-q", "upstream");
      git(fork, "merge", "-q", "--no-edit", "upstream/main");
    };
    /** fork が一時許可を持つ状態(親の user.ts を外で変え、依頼 20261029-120000-user-hook の許可で通す) */
    const forkWithPermit = (/** @type {string} */ parent) => {
      const fork = makeFork(parent);
      write(fork, "src/domains/core/user/user.ts", "export const user = 2;\n");
      commitAll(fork, "outside");
      const draft = ran(runCheck(fork)).entries.find((entry) => entry.reason === "outside-intake")?.permitDraft ?? "";
      write(fork, `.fork-ownership/${FORK_ID}.permits.txt`, `${draft.replace("<依頼の番号>", "20261029-120000-user-hook").replace("<理由>", "待ち")}\n`);
      commitAll(fork, "permit");
      return fork;
    };

    test("台帳に無い notice は履歴で足された本文からも数え、親が本文を消した後も同じ", () => {
      const parent = makeParent();
      const fork = makeFork(parent);
      ship(parent, "20261029-000000-new", "# DOWNSTREAM NOTICE id:20261029-000000-new\ncheckpoint: new\n");
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

    test("fork 成立点の履歴にある notice は継承済み(本文が無くても)", () => {
      const parent = makeParent();
      ship(parent, "20261029-000000-new", "# DOWNSTREAM NOTICE id:20261029-000000-new\n");
      git(parent, "rm", "-q", ".notices/20261029-000000-new.md");
      commitAll(parent, "body removed");
      const fork = makeFork(parent);
      assert.equal(runCheck(fork).status, "pass");
    });

    test("resolves: は本文の最後の版から読み、本文を消した commit を取り込んでも一時許可は失効する", () => {
      const parent = makeParent();
      const fork = forkWithPermit(parent);
      assert.equal(runCheck(fork).status, "pass");
      ship(parent, "20261029-130000-user-hook-intake", "# DOWNSTREAM NOTICE id:20261029-130000-user-hook-intake\nresolves: 20261029-120000-user-hook\n");
      git(parent, "rm", "-q", ".notices/20261029-130000-user-hook-intake.md");
      commitAll(parent, "body removed");
      pull(fork);
      recordLedger(fork, "20261029-130000-user-hook-intake");
      commitAll(fork, "ledger");
      const result = runCheck(fork);
      assert.equal(result.status, "fail");
      assert.equal(result.entries.find((entry) => entry.path === "src/domains/core/user/user.ts")?.permit, "expired-resolved");
    });

    test("改名した notice は新しい名前だけを数える(前の名前は台帳に要らない)", () => {
      const parent = makeParent();
      const fork = makeFork(parent);
      ship(parent, "20261029-000000-old", "# DOWNSTREAM NOTICE id:20261029-000000-old\ncheckpoint: old\n");
      git(parent, "mv", ".notices/20261029-000000-old.md", ".notices/20261029-000000-new.md");
      commitAll(parent, "rename");
      pull(fork);
      assert.deepEqual(notVerified(runCheck(fork)).unrecorded, ["20261029-000000-new"]);
    });
  });
});

test("多段: 上流の単位の中への追加は、その単位のフォルダが Tier1 の版にあるときだけ違反(無ければ中間 Tier の単位 = middle-tier)", () => {
  const tier1Files = new Set(["src/components/Input/Select/index.tsx", "src/lib/crud/index.ts"]);
  const entry = (/** @type {string} */ path, /** @type {string} */ unitFolder) => ({ status: "A", path, kind: null, reason: "inside-unit-add", verdict: "violation", unitFolder });
  const entries = [
    entry("src/components/Input/Select/Extra.tsx", "src/components/Input/Select"),
    entry("src/components/Input/MidUnit/Extra.tsx", "src/components/Input/MidUnit"),
    entry("src/lib/crud/extra.ts", "src/lib/crud"),
    entry("src/lib/midLib/extra.ts", "src/lib/midLib"),
  ];
  const moved = reassignMiddleTier(entries, tier1Files);
  assert.deepEqual(entries.map((e) => e.reason), ["inside-unit-add", "middle-tier", "inside-unit-add", "middle-tier"]);
  assert.equal(moved.length, 2);
});

test("多段: 中間 Tier の既定(*.default.*)の削除・名前の変更は祖先の物として違反のまま(中間 Tier のほかのファイルは middle-tier)", () => {
  const entries = [
    { status: "D", path: "src/domains/mid/services/server/hook.default.ts", kind: null, reason: "deleted", verdict: "violation" },
    { status: "R", path: "src/domains/mid/services/server/renamed.ts", from: "src/domains/mid/services/server/other.default.ts", kind: null, reason: "renamed", verdict: "violation" },
    { status: "D", path: "src/domains/mid/services/server/plain.ts", kind: null, reason: "deleted", verdict: "violation" },
  ];
  const moved = reassignMiddleTier(entries, new Set());
  assert.deepEqual(entries.map((e) => e.reason), ["deleted", "renamed", "middle-tier"]);
  assert.equal(moved.length, 1);
});

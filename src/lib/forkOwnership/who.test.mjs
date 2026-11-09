// pnpm workflow ownership who(who.mjs / whoCli.mjs)の検査。一時の git リポジトリ(Tier1・中間 Tier・fork)を os.tmpdir に作る(ネットワーク不要)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { explainPath, explainView } from "./explain.mjs";
import { parseIntake } from "./intake.mjs";
import { fingerprint } from "./permits.mjs";
import { overrideCandidate, replaceCandidate, whoOwns } from "./who.mjs";

const CLI = resolve(import.meta.dirname, "whoCli.mjs");
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
/** このリポの本物のファイル(宣言・出力の種類のデータ)を表の木に写す */
const real = (path) => readFileSync(join(REPO_ROOT, path), "utf8");
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
  "generated src/registry/district-map.jsonl  # pnpm generate district-map",
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
  write(root, "src/registry/district-map.jsonl", "{}\n");
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

describe("pnpm workflow ownership who", () => {
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
      "src/registry/district-map.jsonl",
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

    const map = resultOf(answer, "src/registry/district-map.jsonl");
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
    // 型: fork の物 = own(置くファイル = そのパス)、変える口の無い親の物 = none(/order <直接の親>)
    assert.deepEqual([own.type, own.write], ["own", "src/features/game/game.ts"]);
    assert.deepEqual([core.type, core.order], ["none", "/order parent"]);
    const text = cli(fork, "--no-fetch", "src/features/core/user/user.ts");
    assert.equal(text.status, 0);
    assert.match(text.stdout, /型: 変えられない/);
    assert.match(text.stdout, /依頼: \/order parent/);
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

describe("型の答え(パスの表、explain.mjs)", () => {
  // 表の木: 宣言と出力の種類のデータはこのリポの本物を写し、その周りに代表のファイルを置く
  const tree = {
    "src/lib/forkOwnership/intake.txt": [
      "edit src/config/**  # 値",
      "generated src/registry/district-map.jsonl  # 生成器の出力",
      "region src/registry/**/*.ts  # 生成器の区画",
      "",
    ].join("\n"),
    "scripts/structure/district-map/gate.json": JSON.stringify({ generate: "generate.mjs", outputs: ["src/registry/district-map.jsonl"] }),
    "scripts/structure/domain/outputs.json": real("scripts/structure/domain/outputs.json"),
    "src/registry/district-map.jsonl": "{}\n",
    // 1 行スイッチ
    "src/features/core/auth/services/server/onDemoUserCreated.default.ts": "export const onDemoUserCreated = 1;\n",
    "src/features/core/auth/services/server/onDemoUserCreated.ts": 'export * from "./onDemoUserCreated.default";\n',
    // 画面と枠のスイッチ
    "src/app/(user)/layout.tsx": 'export { UserLayout as default } from "./_layout/UserLayout";\n',
    "src/app/(user)/_layout/UserLayout.tsx": "export function UserLayout() {}\n",
    "src/app/(user)/frame.ts": "export const frame = {};\n",
    "src/app/(user)/about/page.tsx": 'export { AboutScreen as default } from "./_screen/AboutScreen";\n',
    "src/app/(user)/about/_screen/AboutScreen.tsx": "export function AboutScreen() {}\n",
    // 受け口と上書きの対象の点(宣言は本物)
    "src/features/core/admin/extensionPoints.ts": real("src/features/core/admin/extensionPoints.ts"),
    "src/features/core/admin/menu/items/users.ts": "export const item = {};\n",
    "src/features/core/user/extensionPoints.ts": real("src/features/core/user/extensionPoints.ts"),
    "src/features/core/user/roles/editor.role.json": "{}\n",
    "src/features/core/user/user.ts": "export const user = 1;\n",
    "src/lib/cron/extensionPoints.ts": real("src/lib/cron/extensionPoints.ts"),
    "src/lib/cron/config.ts": "export const config = {};\n",
    "src/app/api/cron/sweep/task.ts": "export const task = {};\n",
    "src/app/api/cron/sweep/route.ts": "export const GET = 1;\n",
    "src/lib/domain/extensionPoints.ts": real("src/lib/domain/extensionPoints.ts"),
    "src/features/core/user/services/server/domainEntry.ts": "export const entry = 1;\n",
    "src/features/core/userProfile/extensionPoints.ts": real("src/features/core/userProfile/extensionPoints.ts"),
    "src/features/core/userProfile/profiles/shop.profile.json": "{}\n",
    // 置き場
    "src/styles/core/extensionPoints.ts": real("src/styles/core/extensionPoints.ts"),
    "src/styles/core/palette.css": ":root {}\n",
    "src/styles/core/theme.css": "@theme {}\n",
    "src/styles/palette.css": "/* fork */\n",
    "src/lib/districtMap/extensionPoints.ts": real("src/lib/districtMap/extensionPoints.ts"),
    "src/config/app/site.config.ts": "export const site = {};\n",
    // pnpm generate domain の物(generate: true / false)
    "src/features/sample/domain.json": JSON.stringify({ plural: "samples" }),
    "src/features/sample/entities/drizzle.ts": "export const t = 1;\n",
    "src/features/sample/services/server/drizzleBase.ts": "export const b = 1;\n",
    "src/features/sample/seed.ts": "export default 1;\n",
    "src/app/admin/(protected)/samples/_screen/loader.ts": "export const loader = 1;\n",
    "src/features/hand/domain.json": JSON.stringify({ generate: false }),
    "src/features/hand/entities/drizzle.ts": "export const t = 1;\n",
  };
  const view = explainView({ files: Object.keys(tree), read: (path) => tree[path] ?? null, intake: parseIntake(tree["src/lib/forkOwnership/intake.txt"]).rules });
  const explain = (path, tier = "tier1", addable = false) => explainPath(path, view, { tier, addable, parent: "parent" });
  const pick = (result) => ({ type: result.type, write: result.write, keys: result.keys, ...(result.source ? { source: result.source } : {}), ...(result.order ? { order: result.order } : {}) });

  const ROWS = [
    // 型 1
    ["1 行スイッチ(素の名前)", "src/features/core/auth/services/server/onDemoUserCreated.ts", { type: "1", write: "src/features/core/auth/services/server/onDemoUserCreated.replace.ts", keys: null, source: "src/features/core/auth/services/server/onDemoUserCreated.ts" }],
    ["1 行スイッチ(既定)", "src/features/core/auth/services/server/onDemoUserCreated.default.ts", { type: "1", write: "src/features/core/auth/services/server/onDemoUserCreated.replace.ts", keys: null, source: "src/features/core/auth/services/server/onDemoUserCreated.ts" }],
    ["画面の page.tsx", "src/app/(user)/about/page.tsx", { type: "1", write: "src/app/(user)/about/_components/", keys: null, source: "src/app/(user)/about/page.tsx" }],
    ["_screen の部品 → page.tsx", "src/app/(user)/about/_screen/AboutScreen.tsx", { type: "1", write: "src/app/(user)/about/_components/", keys: null, source: "src/app/(user)/about/page.tsx" }],
    ["枠の layout.tsx", "src/app/(user)/layout.tsx", { type: "1", write: "src/app/(user)/_components/", keys: null, source: "src/app/(user)/layout.tsx" }],
    ["_layout の部品 → layout.tsx", "src/app/(user)/_layout/UserLayout.tsx", { type: "1", write: "src/app/(user)/_components/", keys: null, source: "src/app/(user)/layout.tsx" }],
    // 型 2
    ["受け口の項目の上書き(overrideOf の鍵)", "src/features/core/admin/menu/items/users.ts", { type: "2", write: "src/features/core/admin/menu/items/users.override.ts", keys: ["hidden", "label", "icon", "allowRoles", "order", "category"], source: "src/features/core/admin/extensionPoints.ts menuItems" }],
    ["ロール", "src/features/core/user/roles/editor.role.json", { type: "2", write: "src/features/core/user/roles/editor.role.override.ts", keys: ["label", "hasProfile", "enabled"], source: "src/features/core/user/extensionPoints.ts roleDefinitions" }],
    ["プロフィール", "src/features/core/userProfile/profiles/shop.profile.json", { type: "2", write: "src/features/core/userProfile/profiles/shop.profile.override.ts", keys: ["tags", "searchFields", "audit"], source: "src/features/core/userProfile/extensionPoints.ts profileDefinitions" }],
    ["cron(フォルダのどのファイルも task.override.ts)", "src/app/api/cron/sweep/route.ts", { type: "2", write: "src/app/api/cron/sweep/task.override.ts", keys: ["schedule", "disabled"], source: "src/lib/cron/extensionPoints.ts cronTasks" }],
    ["domainEntry", "src/features/core/user/services/server/domainEntry.ts", { type: "2", write: "src/features/core/user/services/server/domainEntry.override.ts", keys: ["access"], source: "src/lib/domain/extensionPoints.ts domainEntries" }],
    ["枠の宣言(作ったリポの frame.ts がある)", "src/app/(user)/frame.ts", { type: "2", write: "src/app/(user)/frame.override.ts", keys: ["layout", "page"], source: "src/app/(user)/frame.ts" }],
    ["枠の宣言(frame.ts が無い route = 空の基準)", "src/app/(user)/about/frame.ts", { type: "2", write: "src/app/(user)/about/frame.override.ts", keys: ["layout", "page"] }],
    // 型 3
    ["受け口に足す", "src/features/core/admin/menu/categories/shop.ts", { type: "3", write: "src/features/core/admin/menu/categories/shop.ts", keys: null, source: "src/features/core/admin/extensionPoints.ts menuCategories" }],
    // 型 4
    ["core/<名前>.css ↔ 直下", "src/styles/core/palette.css", { type: "4", write: "src/styles/palette.css", keys: null, source: "src/styles/core/extensionPoints.ts rootStyles" }],
    ["閉じた lib の config", "src/lib/cron/config.ts", { type: "4", write: "src/config/lib/cron.config.ts", keys: null, source: "lib cron" }],
    ["src/config のファイル", "src/config/app/site.config.ts", { type: "4", write: "src/config/app/site.config.ts", keys: null, source: "src/lib/districtMap/extensionPoints.ts configValues" }],
    // 生成物
    ["生成器の出力(gate.json)", "src/registry/district-map.jsonl", { type: "generated", write: null, keys: null, source: "pnpm generate district-map" }],
    ["pnpm generate domain が毎回書く(直す元 = domain.json)", "src/features/sample/entities/drizzle.ts", { type: "generated", write: "src/features/sample/domain.json", keys: null, source: "pnpm generate domain" }],
    ["pnpm generate domain が毎回書く(直す元 = wrappers/)", "src/features/sample/services/server/drizzleBase.ts", { type: "generated", write: "src/features/sample/services/server/wrappers/", keys: null, source: "pnpm generate domain" }],
    ["管理画面の生成物(ルートのフォルダ → ドメイン)", "src/app/admin/(protected)/samples/_screen/loader.ts", { type: "generated", write: "src/features/sample/domain.json", keys: null, source: "pnpm generate domain" }],
    // どれでもない
    ["無いときだけ書く(上流の物)", "src/features/sample/seed.ts", { type: "none", write: null, keys: null, order: "/order parent" }],
    ["generate: false のドメイン(上流の物)", "src/features/hand/entities/drizzle.ts", { type: "none", write: null, keys: null, order: "/order parent" }],
    ["変える口が無い", "src/features/core/user/user.ts", { type: "none", write: null, keys: null, order: "/order parent" }],
    ["置き場の宣言のフォルダでも直下に対が無い", "src/styles/core/theme.css", { type: "none", write: null, keys: null, order: "/order parent" }],
  ];
  for (const [label, path, expected] of ROWS) {
    test(`${label}: ${path}`, () => assert.deepEqual(pick(explain(path)), expected));
  }

  test("own: fork・中間 Tier の物と足してよい新しいパス(generated は own より先)", () => {
    assert.deepEqual(pick(explain("src/features/sample/seed.ts", "fork")), { type: "own", write: "src/features/sample/seed.ts", keys: null });
    assert.deepEqual(pick(explain("src/features/hand/entities/drizzle.ts", "middle")), { type: "own", write: "src/features/hand/entities/drizzle.ts", keys: null });
    assert.equal(explain("src/features/sample/entities/drizzle.ts", "fork").type, "generated");
    assert.deepEqual(pick(explain("src/features/game/game.ts", "missing", true)), { type: "own", write: "src/features/game/game.ts", keys: null });
    assert.equal(explain("src/features/core/user/new.ts", "missing", false).type, "none");
  });

  test("このリポ(Tier1、HEAD の木)の代表のパス", () => {
    const answer = whoOwns(REPO_ROOT, [
      "src/app/admin/_layout/AdminHeader.tsx",
      "src/styles/core/palette.css",
      "src/lib/cron/config.ts",
      "src/features/core/user/coreRoles/admin.role.json",
      "src/app/(user)/frame.ts",
      "src/app/(user)/(protected)/mypage/_screen/MyPageScreen.tsx",
      "src/features/sample/entities/drizzle.ts",
    ]);
    assert.equal(answer.status, "tier1");
    const typeOf = (path) => {
      const result = resultOf(answer, path);
      return [result.type, result.write];
    };
    assert.deepEqual(typeOf("src/app/admin/_layout/AdminHeader.tsx"), ["1", "src/app/admin/_layout/AdminHeader.replace.tsx"]);
    assert.deepEqual(typeOf("src/styles/core/palette.css"), ["4", "src/styles/palette.css"]);
    assert.deepEqual(typeOf("src/lib/cron/config.ts"), ["4", "src/config/lib/cron.config.ts"]);
    assert.deepEqual(typeOf("src/features/core/user/coreRoles/admin.role.json"), ["2", "src/features/core/user/coreRoles/admin.role.override.ts"]);
    assert.deepEqual(typeOf("src/app/(user)/frame.ts"), ["2", "src/app/(user)/frame.override.ts"]);
    assert.deepEqual(typeOf("src/app/(user)/(protected)/mypage/_screen/MyPageScreen.tsx"), ["1", "src/app/(user)/(protected)/mypage/_components/"]);
    assert.deepEqual(typeOf("src/features/sample/entities/drizzle.ts"), ["generated", "src/features/sample/domain.json"]);
  });
});

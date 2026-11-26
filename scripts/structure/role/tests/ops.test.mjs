// pnpm generate role -- --order・pnpm generate role -- --delete・pnpm generate role -- --delete-profile・pnpm generate role -- --toggle・pnpm generate role -- --profile の引数と止まり方の契約テスト（既定は対話なし、-i のときだけ対話）。
// コマンドはスクリプトの置き場からリポジトリのルートを決めるので、一時ディレクトリに要るものを写して、そこで実行する。
// 標準入力は空にして、対話が出ない（待たない）ことも見る。実行: pnpm test scripts/structure/role/tests/ops.test.mjs
// 写すコードは走らせる命令から import で届くファイル(copyByImports)、手書きの一覧は命令が読むデータと命令の置き場だけ。
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyByImports } from "../../../runner/test/lib.copyByImports.mjs";
import { ENV, git } from "../../../../src/lib/forkOwnership/testRepos.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
// 走らせる命令(この入口から import で届くコードは before で足す)
const COMMANDS = ["deleteProfile.mjs", "deleteRole.mjs", "generate.mjs", "generateProfile.mjs", "toggleRole.mjs"];
// 命令の置き場と、命令が import ではなくファイルとして読む物
const COPY = [
  "scripts/structure/role",
  "src/lib/forkOwnership",
  "src/domains/core/user/roles",
  "src/domains/core/user/coreRoles",
  "src/domains/core/userProfile",
  "src/domains/core/user/extensions",
  "src/domains/core/user/extensionPoints.ts",
  "src/registry",
  // 持ち主の判定(rolePaths.mjs の parentOwns)が読む名前の宣言: Tier1 = 全部が自分の物
  "repo.json",
  "src/lib/CATALOG.md",
];
let root;
before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "role-ops-"));
  const entries = COMMANDS.map((c) => `scripts/structure/role/${c}`);
  await copyByImports({ from: repoRoot, to: root, entries, data: COPY, nodeModules: true });
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

const run = (script, ...args) => spawnSync("node", [path.join(root, "scripts/structure/role", script), ...args], { cwd: root, encoding: "utf8", input: "", timeout: 20000 });
const rolePath = (file) => path.join(root, "src/domains/core/user/roles", file);
const coreRolePath = (file) => path.join(root, "src/domains/core/user/coreRoles", file);
const readRole = (file) => JSON.parse(fs.readFileSync(rolePath(file), "utf8"));

test("pnpm generate role -- --toggle: ID と --on|--off が必須（無い・両方 = 1）、--on / --off は何度回しても同じ結果", () => {
  assert.equal(run("toggleRole.mjs").status, 1);
  const noFlag = run("toggleRole.mjs", "contributor");
  assert.equal(noFlag.status, 1);
  assert.match(noFlag.stderr, /--on か --off/);
  assert.equal(run("toggleRole.mjs", "contributor", "--on", "--off").status, 1);
  assert.equal(run("toggleRole.mjs", "contributor", "--on").status, 0);
  assert.equal(readRole("contributor.role.json").enabled, true);
  assert.equal(run("toggleRole.mjs", "contributor", "--on").status, 0);
  assert.equal(readRole("contributor.role.json").enabled, true);
  assert.equal(run("toggleRole.mjs", "contributor", "--off").status, 0);
  assert.equal(readRole("contributor.role.json").enabled, false);
  assert.equal(run("toggleRole.mjs", "contributor", "--bogus").status, 1);
});

test("上書き: pnpm generate role が重ね、JSON は変えない。不正は止まり、空は通る(隣に対象なしは pnpm check extensions)。toggle と hasProfile の書き戻しは止まり、--remove-json は一緒に消す", () => {
  const rolesFile = path.join(root, "src/domains/core/user/extensions/roles.ts");
  const profileDir = path.join(root, "src/domains/core/userProfile/profiles");
  const extensions = path.join(root, "src/domains/core/userProfile/extensions");
  const list = (name) => fs.readFileSync(path.join(extensions, `${name}.ts`), "utf8");
  const typed = (type, body) => `import type { ${type} } from "../types";\nexport const override: ${type} = ${body};\n`;
  const writeCore = (file, text) => fs.writeFileSync(coreRolePath(file), text);
  const writeRole = (file, text) => fs.writeFileSync(rolePath(file), text);
  writeRole("auditor.role.json", JSON.stringify({ id: "auditor", label: "監査", category: "user", hasProfile: false }));

  // hasProfile: true の上書きでプロフィールが生成され、一覧の値が重なる。JSON はそのまま
  const userBefore = fs.readFileSync(coreRolePath("user.role.json"), "utf8");
  fs.writeFileSync(path.join(profileDir, "user.profile.json"), JSON.stringify({ roleId: "user", fields: [{ name: "nick", label: "呼び名", fieldType: "string", formInput: "textInput" }] }));
  writeCore("user.role.override.ts", typed("CoreRoleOverride", '{ label: "会員", hasProfile: true }'));
  fs.writeFileSync(path.join(profileDir, "user.profile.override.ts"), typed("ProfileOverride", '{ tags: { selfEdit: ["nick"] }, searchFields: ["nick"] }'));
  const generated = run("generate.mjs", "user");
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(fs.readFileSync(coreRolePath("user.role.json"), "utf8"), userBefore);
  assert.match(fs.readFileSync(rolesFile, "utf8"), /\{ \.\.\.userRole, label: "会員", hasProfile: true \} as RoleConfig/);
  assert.match(list("profileConfigs"), /user: \{ \.\.\.userProfile, tags: \{"selfEdit":\["nick"\]\}, searchFields: \["nick"\] \} as ProfileConfig/);
  assert.match(list("profileBases"), /user: createProfileBase\(UserProfileTable, \{ defaultSearchFields: \["nick"\] \}\)/);
  assert.doesNotMatch(list("profileBases"), /user\.profile\.json/);
  assert.match(fs.readFileSync(path.join(root, "src/domains/core/userProfile/entities/profiles/user/drizzle.ts"), "utf8"), /nick/);

  // 不正な上書きは止まる
  const bad = {
    "未知キー": [typed("RoleOverride", '{ category: "admin" }'), /知らないキー category/],
    "型違い": [typed("RoleOverride", '{ hasProfile: "yes" }'), /hasProfile は true か false/],
    "リテラルでない": ['const x = "a";\nexport const override = { label: x };\n', /書けるのは import type/],
    "値 import": ['import { z } from "./z";\nexport const override = {};\n', /import は型だけ/],
    "別名 import": ['import type { RoleOverride } from "@/domains/core/user/types";\nexport const override: RoleOverride = {};\n', /import は相対パス/],
    "export が無い": ['import type { RoleOverride } from "../types";\n', /export const override = \{ … \} がありません/],
  };
  for (const [name, [text, message]] of Object.entries(bad)) {
    writeCore("user.role.override.ts", text);
    const failed = run("generate.mjs", "--all");
    assert.equal(failed.status, 1, name);
    assert.match(failed.stderr, message, name);
    assert.match(failed.stderr, /\[user\.role\.override\.ts\]/, name);
  }

  // fields は上書きできない。タグは上書き後の項目で検査する
  writeCore("user.role.override.ts", typed("RoleOverride", "{ hasProfile: true }"));
  const profileOverride = path.join(profileDir, "user.profile.override.ts");
  fs.writeFileSync(profileOverride, typed("ProfileOverride", "{ fields: [] }"));
  assert.match(run("generate.mjs", "--all").stderr, /知らないキー fields/);
  fs.writeFileSync(profileOverride, typed("ProfileOverride", '{ tags: { selfEdit: ["missing"] } }'));
  assert.match(run("generate.mjs", "--all").stderr, /tags "selfEdit" の "missing"/);
  fs.writeFileSync(profileOverride, typed("ProfileOverride", '{ audit: { targetType: "x" } }'));
  assert.match(run("generate.mjs", "--all").stderr, /audit\.actionPrefix/);
  fs.writeFileSync(profileOverride, typed("ProfileOverride", '{ audit: { targetType: "userProfile", actionPrefix: "user_profile", trackedFields: ["nick"], bulkMode: "detail" } }'));
  const audited = run("generate.mjs", "--all");
  assert.equal(audited.status, 0, audited.stderr);
  assert.match(list("profileBases"), /import \{ auditLogger \} from/);
  assert.match(list("profileBases"), /user: createProfileBase\(UserProfileTable, \{ defaultSearchFields: \(userProfile as ProfileConfig\)\.searchFields, audit: \{ enabled: true, targetType: "userProfile", actionPrefix: "user_profile", trackedFields: \["nick"\], bulkMode: "detail", recorder: auditLogger \} \}\)/);
  assert.doesNotMatch(list("profileBases"), /contributor: .*audit/);
  fs.writeFileSync(profileOverride, "// 親の上書きを外す\n");

  // 隣に対象の無い上書きは pnpm check extensions の孤立の検査(scripts/structure/extensions/orphans.mjs)。生成は止めない
  writeRole("user.role.override.ts", typed("RoleOverride", "{}"));
  assert.equal(run("generate.mjs", "editor").status, 0);
  fs.unlinkSync(rolePath("user.role.override.ts"));

  // core ロールは enabled を上書きできない
  writeCore("debugger.role.override.ts", typed("CoreRoleOverride", "{ enabled: false }"));
  assert.match(run("generate.mjs", "--all").stderr, /\[debugger\.role\.override\.ts\] 知らないキー enabled/);
  fs.unlinkSync(coreRolePath("debugger.role.override.ts"));

  // 置き場: roles/ に core の ID、coreRoles/ に知らないファイル、isCore
  const userInRoles = rolePath("user.role.json");
  fs.writeFileSync(userInRoles, fs.readFileSync(coreRolePath("user.role.json"), "utf8"));
  assert.match(run("generate.mjs", "--all").stderr, /\[roles\/user\.role\.json\] core ロールと同じ ID/);
  fs.unlinkSync(userInRoles);
  const extraCore = coreRolePath("extra.role.json");
  fs.writeFileSync(extraCore, "{}");
  assert.match(run("generate.mjs", "editor").stderr, /\[coreRoles\/extra\.role\.json\]/);
  fs.unlinkSync(extraCore);
  const auditorJson = fs.readFileSync(rolePath("auditor.role.json"), "utf8");
  writeRole("auditor.role.json", JSON.stringify({ ...JSON.parse(auditorJson), isCore: false }));
  assert.match(run("generate.mjs", "auditor").stderr, /isCore は廃止/);
  writeRole("auditor.role.json", auditorJson);

  // core ロールは消せない・切り替えられない
  for (const id of ["admin", "user", "debugger"]) {
    const deleted = run("deleteRole.mjs", id, "--confirm", id);
    assert.equal(deleted.status, 1, id);
    assert.match(deleted.stderr, /削除できません/, id);
    assert.equal(run("toggleRole.mjs", id, "--off").status, 1, id);
    assert.ok(fs.existsSync(coreRolePath(`${id}.role.json`)), id);
  }

  // 空のプロフィールの上書きは通る
  const passed = run("generate.mjs", "--all");
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(list("profileConfigs"), /user: userProfile as ProfileConfig/);

  // toggle: enabled を上書きしていると JSON を書かず止まる
  const debuggerBefore = fs.readFileSync(rolePath("auditor.role.json"), "utf8");
  writeRole("auditor.role.override.ts", typed("RoleOverride", "{ enabled: false }"));
  const toggled = run("toggleRole.mjs", "auditor", "--on");
  assert.equal(toggled.status, 1);
  assert.match(toggled.stderr, /auditor\.role\.override\.ts が決めています/);
  assert.equal(fs.readFileSync(rolePath("auditor.role.json"), "utf8"), debuggerBefore);
  fs.unlinkSync(rolePath("auditor.role.override.ts"));

  // hasProfile を上書きしていると pnpm generate role -- --delete-profile は消さず止まる
  const stopped = run("deleteProfile.mjs", "user", "--confirm", "user");
  assert.equal(stopped.status, 1);
  assert.match(stopped.stderr, /user\.role\.override\.ts が決めています/);
  assert.ok(fs.existsSync(path.join(root, "src/domains/core/userProfile/entities/profiles/user")));

  // --remove-json は上書きも一緒に消す
  writeRole("auditor.role.override.ts", typed("RoleOverride", '{ label: "監査 2" }'));
  assert.equal(run("generate.mjs", "auditor").status, 0);
  assert.equal(run("deleteRole.mjs", "auditor", "--confirm", "auditor", "--remove-json").status, 0);
  assert.equal(fs.existsSync(rolePath("auditor.role.override.ts")), false);
  // core ロールの上書きは消さずに直す。プロフィールは pnpm generate role -- --delete-profile --remove-json が上書きごと消す
  fs.unlinkSync(coreRolePath("user.role.override.ts"));
  assert.equal(run("deleteProfile.mjs", "user", "--confirm", "user", "--remove-json").status, 0);
  assert.equal(fs.existsSync(profileOverride), false);
});

test("ロールの一覧の並び(= enum user_role): 今あるロールの作り直しは場所のまま、新しいロールは末尾、--order はその並びに書き直し、知らない ID・重複・抜けは書かずに 2", () => {
  const rolesFile = path.join(root, "src/domains/core/user/extensions/roles.ts");
  const order = () => [...fs.readFileSync(rolesFile, "utf8").matchAll(/^import \w+Role from "@\/domains\/core\/user\/(?:coreRoles|roles)\/([\w-]+)\.role\.json";$/gm)].map(([, id]) => id);
  const before = order();
  assert.ok(before.length >= 3);

  // 今あるロールの作り直し(先頭と真ん中)で並びは変わらない
  for (const id of [before[0], before[1]]) {
    const regenerated = run("generate.mjs", id);
    assert.equal(regenerated.status, 0, regenerated.stderr);
    assert.deepEqual(order(), before);
  }

  // 新しいロールは末尾
  fs.writeFileSync(rolePath("zeta.role.json"), JSON.stringify({ id: "zeta", label: "ゼータ", category: "user", hasProfile: false }));
  assert.equal(run("generate.mjs", "zeta").status, 0);
  assert.deepEqual(order(), [...before, "zeta"]);

  // --order: その並びに書き直して全部を作り直す
  const reversed = [...before, "zeta"].reverse();
  const reordered = run("generate.mjs", "--order", reversed.join(","));
  assert.equal(reordered.status, 0, reordered.stderr);
  assert.deepEqual(order(), reversed);

  // 知らない ID・重複・抜けは止まり、何も書かない
  const content = fs.readFileSync(rolesFile, "utf8");
  for (const [ids, message] of [
    [[...reversed, "nobody"], /ロール設定の無い ID: nobody/],
    [[...reversed, reversed[0]], /2 回以上ある ID/],
    [reversed.slice(1), /並びに無いロール/],
  ]) {
    const refused = run("generate.mjs", "--order", ids.join(","));
    assert.equal(refused.status, 2, ids.join(","));
    assert.match(refused.stderr, message);
    assert.equal(fs.readFileSync(rolesFile, "utf8"), content);
  }
  assert.equal(run("generate.mjs", "--order").status, 2);

  // 元に戻す
  assert.equal(run("generate.mjs", "--order", [...before, "zeta"].join(",")).status, 0);
  assert.equal(run("deleteRole.mjs", "zeta", "--confirm", "zeta", "--remove-json").status, 0);
  assert.deepEqual(order(), before);
});

test("pnpm generate role -- --profile: ID か --all が必須、見つからない = 1", () => {
  assert.equal(run("generateProfile.mjs").status, 1);
  const missing = run("generateProfile.mjs", "nobody");
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /見つかりません/);
  assert.equal(run("generateProfile.mjs", "contributor", "--all").status, 1);
});

test("pnpm generate role -- --delete / pnpm generate role -- --delete-profile: ID 必須、--confirm が無い・違うなら消さずに 1、一致で消す（JSON は --remove-json のときだけ）", () => {
  for (const script of ["deleteRole.mjs", "deleteProfile.mjs"]) {
    assert.equal(run(script).status, 1, script);
    const missing = run(script, "contributor");
    assert.equal(missing.status, 1, script);
    assert.match(missing.stderr, /--confirm/, script);
    assert.equal(run(script, "contributor", "--confirm", "editor").status, 1, script);
  }
  assert.ok(fs.existsSync(rolePath("contributor.role.json")));
  const registry = path.join(root, "src/domains/core/user/extensions/roles.ts");
  assert.match(fs.readFileSync(registry, "utf8"), /contributorRole/);
  assert.equal(run("deleteRole.mjs", "contributor", "--confirm", "contributor").status, 0);
  assert.doesNotMatch(fs.readFileSync(registry, "utf8"), /contributorRole/);
  assert.ok(fs.existsSync(rolePath("contributor.role.json")));
  assert.equal(run("deleteRole.mjs", "editor", "--confirm", "editor", "--remove-json").status, 0);
  assert.equal(fs.existsSync(rolePath("editor.role.json")), false);
  assert.equal(run("deleteRole.mjs", "nobody", "--confirm", "nobody").status, 1);
});

test("fork で親の持ち物の JSON は書かない・消さない: toggle は上書きの enabled、--delete --remove-json は enabled: false、hasProfile の書き戻しは上書き、プロフィールの JSON は残す。自分で足した JSON は今どおり", async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "role-fork-"));
  try {
    // 親(Tier1 役) = 道具と role の置き場の写し。fork = その clone(親の remote = upstream)
    const parent = path.join(base, "parent");
    await copyByImports({ from: repoRoot, to: parent, entries: COMMANDS.map((c) => `scripts/structure/role/${c}`), data: COPY });
    fs.writeFileSync(path.join(parent, ".gitignore"), "node_modules\n");
    fs.writeFileSync(path.join(parent, "src/domains/core/userProfile/profiles/contributor.profile.json"), JSON.stringify({ roleId: "contributor", fields: [{ name: "nick", label: "呼び名", fieldType: "string", formInput: "textInput" }] }));
    git(parent, "init", "-q", "-b", "main");
    git(parent, "add", "-A");
    git(parent, "commit", "-q", "-m", "base");
    const fork = path.join(base, "fork");
    git(base, "clone", "-q", parent, fork);
    git(fork, "remote", "rename", "origin", "upstream");
    fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(fork, "node_modules"), "dir");
    fs.writeFileSync(path.join(fork, "repo.json"), JSON.stringify({ repo_id: "child", tier: "leaf" }, null, 2) + "\n");
    git(fork, "commit", "-q", "-am", "fork start");
    const runIn = (script, ...args) => spawnSync("node", [path.join(fork, "scripts/structure/role", script), ...args], { cwd: fork, encoding: "utf8", input: "", timeout: 20000, env: ENV });
    const roles = path.join(fork, "src/domains/core/user/roles");
    const profiles = path.join(fork, "src/domains/core/userProfile/profiles");
    const changed = () => git(fork, "status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).map((line) => line.slice(3)).sort();
    const overrideText = () => fs.readFileSync(path.join(roles, "contributor.role.override.ts"), "utf8");

    // toggle: 親の JSON はそのまま、隣の上書きに enabled(作り直しは値だけ置き換える)
    const on = runIn("toggleRole.mjs", "contributor", "--on");
    assert.equal(on.status, 0, on.stderr);
    assert.deepEqual(changed(), ["src/domains/core/user/roles/contributor.role.override.ts"]);
    assert.match(overrideText(), /import type \{ RoleOverride \} from "\.\.\/types";[\s\S]*export const override: RoleOverride = \{ enabled: true \};/);
    assert.equal(runIn("toggleRole.mjs", "contributor", "--off").status, 0);
    assert.match(overrideText(), /\{ enabled: false \}/);

    // 自分で足した JSON(まだコミットしていない物も)は今どおり JSON を書く
    fs.writeFileSync(path.join(roles, "auditor.role.json"), JSON.stringify({ id: "auditor", label: "監査", category: "user", hasProfile: false }));
    assert.equal(runIn("toggleRole.mjs", "auditor", "--off").status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(roles, "auditor.role.json"), "utf8")).enabled, false);
    assert.equal(fs.existsSync(path.join(roles, "auditor.role.override.ts")), false);

    // hasProfile の書き戻し(--delete-profile): 親のロールは上書きに hasProfile: false、--remove-json でも親のプロフィールの JSON は残す
    fs.writeFileSync(path.join(roles, "contributor.role.override.ts"), 'import type { RoleOverride } from "../types";\n\n// 試し\nexport const override: RoleOverride = { enabled: true, hasProfile: true };\n');
    const dropped = runIn("deleteProfile.mjs", "contributor", "--confirm", "contributor", "--remove-json");
    assert.equal(dropped.status, 0, dropped.stderr);
    assert.match(dropped.stdout, /contributor\.profile\.json は親の持ち物なので残しました/);
    assert.ok(fs.existsSync(path.join(profiles, "contributor.profile.json")));
    assert.match(overrideText(), /\/\/ 試し\nexport const override: RoleOverride = \{ enabled: true, hasProfile: false \};/);

    // --delete --remove-json: 親の JSON は消さずに上書きで enabled: false。自分の JSON は今どおり消す
    const deleted = runIn("deleteRole.mjs", "contributor", "--confirm", "contributor", "--remove-json");
    assert.equal(deleted.status, 0, deleted.stderr);
    assert.ok(fs.existsSync(path.join(roles, "contributor.role.json")));
    assert.match(overrideText(), /\{ enabled: false, hasProfile: false \}/);
    assert.equal(git(fork, "diff", "--name-only", "HEAD", "--", "src/domains/core/user/roles/contributor.role.json", "src/domains/core/userProfile/profiles/contributor.profile.json"), "");
    assert.equal(runIn("deleteRole.mjs", "auditor", "--confirm", "auditor", "--remove-json").status, 0);
    assert.equal(fs.existsSync(path.join(roles, "auditor.role.json")), false);

    // 親の remote が無い = 見分けられない → 書かずに止まる
    git(fork, "remote", "remove", "upstream");
    const blind = runIn("toggleRole.mjs", "editor", "--off");
    assert.notEqual(blind.status, 0);
    assert.match(blind.stderr, /見分けられない/);
    assert.equal(git(fork, "diff", "--name-only", "HEAD", "--", "src/domains/core/user/roles/editor.role.json"), "");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// role:delete・prof:delete・role:toggle・prof:generate の引数と止まり方の契約テスト（既定は対話なし、-i のときだけ対話）。
// コマンドはスクリプトの置き場からリポジトリのルートを決めるので、一時ディレクトリに要るものを写して、そこで実行する。
// 標準入力は空にして、対話が出ない（待たない）ことも見る。実行: pnpm test:role-config-ops
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const COPY = [
  "scripts/structure/role",
  "scripts/structure/domain/spec",
  "scripts/structure/domain/checks",
  "scripts/structure/domain/domain",
  "scripts/structure/extensions",
  "src/lib/forkOwnership",
  "src/lib/domain/fields",
  "src/utils",
  "src/features/core/user/roles",
  "src/features/core/user/coreRoles",
  "src/features/core/userProfile",
  "src/features/core/user/extensions",
  "src/registry",
];
let root;
before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "role-ops-"));
  for (const rel of COPY) fs.cpSync(path.join(repoRoot, rel), path.join(root, rel), { recursive: true });
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

const run = (script, ...args) => spawnSync("node", [path.join(root, "scripts/structure/role", script), ...args], { cwd: root, encoding: "utf8", input: "", timeout: 20000 });
const rolePath = (file) => path.join(root, "src/features/core/user/roles", file);
const coreRolePath = (file) => path.join(root, "src/features/core/user/coreRoles", file);
const readRole = (file) => JSON.parse(fs.readFileSync(rolePath(file), "utf8"));

test("role:toggle: ID と --on|--off が必須（無い・両方 = 1）、--on / --off は何度回しても同じ結果", () => {
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

test("上書き: role:generate が重ね、JSON は変えない。不正・隣に対象なしは止まり、空は通る。toggle と hasProfile の書き戻しは止まり、--remove-json は一緒に消す", () => {
  const rolesFile = path.join(root, "src/features/core/user/extensions/roles.ts");
  const profileDir = path.join(root, "src/features/core/userProfile/profiles");
  const extensions = path.join(root, "src/features/core/userProfile/extensions");
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
  assert.match(fs.readFileSync(path.join(root, "src/features/core/userProfile/entities/profiles/user/drizzle.ts"), "utf8"), /nick/);

  // 不正な上書きは止まる
  const bad = {
    "未知キー": [typed("RoleOverride", '{ category: "admin" }'), /知らないキー category/],
    "型違い": [typed("RoleOverride", '{ hasProfile: "yes" }'), /hasProfile は true か false/],
    "リテラルでない": ['const x = "a";\nexport const override = { label: x };\n', /書けるのは import type/],
    "値 import": ['import { z } from "./z";\nexport const override = {};\n', /import は型だけ/],
    "別名 import": ['import type { RoleOverride } from "@/features/core/user/types";\nexport const override: RoleOverride = {};\n', /import は相対パス/],
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

  // 隣に対象なし（core ロールの上書きを roles/ に置いた）
  writeRole("user.role.override.ts", typed("RoleOverride", "{}"));
  const stray = run("generate.mjs", "editor");
  assert.equal(stray.status, 1);
  assert.match(stray.stderr, /\[user\.role\.override\.ts\] 隣に対象の user\.role\.json がありません/);
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

  // hasProfile を上書きしていると prof:delete は消さず止まる
  const stopped = run("deleteProfile.mjs", "user", "--confirm", "user");
  assert.equal(stopped.status, 1);
  assert.match(stopped.stderr, /user\.role\.override\.ts が決めています/);
  assert.ok(fs.existsSync(path.join(root, "src/features/core/userProfile/entities/profiles/user")));

  // --remove-json は上書きも一緒に消す
  writeRole("auditor.role.override.ts", typed("RoleOverride", '{ label: "監査 2" }'));
  assert.equal(run("generate.mjs", "auditor").status, 0);
  assert.equal(run("deleteRole.mjs", "auditor", "--confirm", "auditor", "--remove-json").status, 0);
  assert.equal(fs.existsSync(rolePath("auditor.role.override.ts")), false);
  // core ロールの上書きは消さずに直す。プロフィールは prof:delete --remove-json が上書きごと消す
  fs.unlinkSync(coreRolePath("user.role.override.ts"));
  assert.equal(run("deleteProfile.mjs", "user", "--confirm", "user", "--remove-json").status, 0);
  assert.equal(fs.existsSync(profileOverride), false);
});

test("prof:generate: ID か --all が必須、見つからない = 1", () => {
  assert.equal(run("generateProfile.mjs").status, 1);
  const missing = run("generateProfile.mjs", "nobody");
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /見つかりません/);
  assert.equal(run("generateProfile.mjs", "contributor", "--all").status, 1);
});

test("role:delete / prof:delete: ID 必須、--confirm が無い・違うなら消さずに 1、一致で消す（JSON は --remove-json のときだけ）", () => {
  for (const script of ["deleteRole.mjs", "deleteProfile.mjs"]) {
    assert.equal(run(script).status, 1, script);
    const missing = run(script, "contributor");
    assert.equal(missing.status, 1, script);
    assert.match(missing.stderr, /--confirm/, script);
    assert.equal(run(script, "contributor", "--confirm", "editor").status, 1, script);
  }
  assert.ok(fs.existsSync(rolePath("contributor.role.json")));
  const registry = path.join(root, "src/features/core/user/extensions/roles.ts");
  assert.match(fs.readFileSync(registry, "utf8"), /contributorRole/);
  assert.equal(run("deleteRole.mjs", "contributor", "--confirm", "contributor").status, 0);
  assert.doesNotMatch(fs.readFileSync(registry, "utf8"), /contributorRole/);
  assert.ok(fs.existsSync(rolePath("contributor.role.json")));
  assert.equal(run("deleteRole.mjs", "editor", "--confirm", "editor", "--remove-json").status, 0);
  assert.equal(fs.existsSync(rolePath("editor.role.json")), false);
  assert.equal(run("deleteRole.mjs", "nobody", "--confirm", "nobody").status, 1);
});

// scripts/workflow/local-settings/local-settings.test.ts — 手元の設定を整える命令(一時のチェックアウトと一時の HOME だけに書く)
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  OLD_DENY,
  applyPlan,
  buildPlan,
  decidesOf,
  flatten,
  formatLayers,
  formatPlan,
  parseOptions,
  showLayers,
  type Paths,
} from "./lib";

const made: string[] = [];
after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** 一時のチェックアウトと一時の HOME の場所 */
const setup = (local?: unknown, user?: unknown): Paths => {
  const root = mkdtempSync(path.join(tmpdir(), "local-settings-root-"));
  const home = mkdtempSync(path.join(tmpdir(), "local-settings-home-"));
  made.push(root, home);
  const paths: Paths = {
    root,
    local: path.join(root, ".claude/settings.local.json"),
    project: path.join(root, ".claude/settings.json"),
    user: path.join(home, ".claude/settings.json"),
    managed: [path.join(root, "no-managed.json")],
  };
  if (local !== undefined) {
    mkdirSync(path.dirname(paths.local), { recursive: true });
    writeFileSync(paths.local, typeof local === "string" ? local : JSON.stringify(local));
  }
  if (user !== undefined) {
    mkdirSync(path.dirname(paths.user), { recursive: true });
    writeFileSync(paths.user, typeof user === "string" ? user : JSON.stringify(user));
  }
  return paths;
};

const DEFAULT = { grant: true, dropDeny: [] as string[], bypass: false };

/** 上流が昔配った形の手元の設定(全部許可・acceptEdits・deny 3 行・絶対パスの単発許可・秘密の env) */
const LEGACY = {
  permissions: {
    defaultMode: "acceptEdits",
    allow: ["Bash(*)", "Edit", "Write", "mcp__playwright__*", "Bash(/home/x/bin/tool --y)"],
    deny: [...OLD_DENY],
  },
  env: { SECRET_TOKEN: "s3cr3t" },
};

test("plan: 新しい中身は印・MCP の有効化・残す deny だけ。消える行を出し、env の値は出さない。何も書かない", () => {
  const paths = setup(LEGACY);
  const before = readFileSync(paths.local, "utf8");
  const plan = buildPlan(paths, DEFAULT);
  assert.deepEqual(plan.next, { env: { DEVCHECK_GRANT: "on" }, enabledMcpjsonServers: ["playwright"], permissions: { deny: OLD_DENY } });
  assert.ok(plan.vanishing.includes('permissions.defaultMode = "acceptEdits"'));
  assert.ok(plan.vanishing.includes('permissions.allow[] = "Bash(*)"'));
  assert.ok(plan.vanishing.includes("env.SECRET_TOKEN = (値は表示しない)"));
  assert.ok(!plan.vanishing.some((l) => l.includes("deny")));
  const text = formatPlan(plan, DEFAULT);
  assert.doesNotMatch(text, /s3cr3t/);
  assert.match(text, /昔の deny の行\(残す。消すなら --drop-deny=<行>\)/);
  assert.doesNotMatch(JSON.stringify(plan.next), /allow|Bash\(\*\)|\/home\//);
  assert.equal(readFileSync(paths.local, "utf8"), before);
  assert.equal(existsSync(paths.user), false);
});

test("plan: --no-grant は印を書かない / --drop-deny は選んだ行だけ消す / 無い行は止める", () => {
  const paths = setup(LEGACY);
  assert.deepEqual(buildPlan(paths, { ...DEFAULT, grant: false }).next, { enabledMcpjsonServers: ["playwright"], permissions: { deny: OLD_DENY } });
  const dropped = buildPlan(paths, { ...DEFAULT, dropDeny: OLD_DENY });
  assert.deepEqual(dropped.next, { env: { DEVCHECK_GRANT: "on" }, enabledMcpjsonServers: ["playwright"] });
  assert.ok(dropped.vanishing.includes('permissions.deny[] = "Bash(sudo:*)"'));
  assert.throws(() => buildPlan(paths, { ...DEFAULT, dropDeny: ["Bash(x)"] }), /消す deny の行 "Bash\(x\)" は今の手元に無い/);
  // 手元が無い = 消える行なし
  assert.deepEqual(buildPlan(setup(), DEFAULT).vanishing, []);
});

test("plan --bypass: 個人設定の変わる 2 項目だけを見せる(同じ値なら出さない)", () => {
  const paths = setup(undefined, { permissions: { defaultMode: "default", allow: ["X"] }, theme: "dark" });
  const plan = buildPlan(paths, { ...DEFAULT, bypass: true });
  assert.deepEqual(plan.userChanges, [
    { key: "permissions.defaultMode", before: "default", after: "bypassPermissions" },
    { key: "skipDangerousModePermissionPrompt", before: null, after: true },
  ]);
  assert.match(formatPlan(plan, { ...DEFAULT, bypass: true }), /次の起動から効く/);
  const done = setup(undefined, { permissions: { defaultMode: "bypassPermissions" }, skipDangerousModePermissionPrompt: true });
  assert.deepEqual(buildPlan(done, { ...DEFAULT, bypass: true }).userChanges, []);
  assert.deepEqual(buildPlan(paths, DEFAULT).userChanges, []);
});

test("apply: 控え → 手元の全面書き換え。個人設定には触れない", () => {
  const paths = setup(LEGACY, { theme: "dark" });
  const userBefore = readFileSync(paths.user, "utf8");
  const applied = applyPlan(paths, DEFAULT, new Date("2026-11-12T03:04:05Z"));
  assert.equal(applied.localBackup, path.join(paths.root, ".agent/settings.local.20261112-030405.json"));
  assert.deepEqual(JSON.parse(readFileSync(applied.localBackup!, "utf8")), LEGACY);
  assert.deepEqual(JSON.parse(readFileSync(paths.local, "utf8")), buildPlan(paths, DEFAULT).next);
  assert.equal(readFileSync(paths.user, "utf8"), userBefore);
  assert.equal(applied.userFile, null);
});

test("apply --bypass: 個人設定は 2 項目だけ書き、ほかの項目は残す。控えも残す。無ければ作る", () => {
  const user = { permissions: { allow: ["X"], defaultMode: "default" }, theme: "dark", hooks: { Stop: [] } };
  const paths = setup(undefined, user);
  const applied = applyPlan(paths, { ...DEFAULT, bypass: true }, new Date("2026-11-12T03:04:05Z"));
  const written = JSON.parse(readFileSync(paths.user, "utf8"));
  assert.deepEqual(written, { ...user, permissions: { allow: ["X"], defaultMode: "bypassPermissions" }, skipDangerousModePermissionPrompt: true });
  assert.deepEqual(JSON.parse(readFileSync(applied.userBackup!, "utf8")), user);
  assert.equal(applied.localBackup, null);
  const fresh = setup();
  applyPlan(fresh, { ...DEFAULT, bypass: true });
  assert.deepEqual(JSON.parse(readFileSync(fresh.user, "utf8")), { permissions: { defaultMode: "bypassPermissions" }, skipDangerousModePermissionPrompt: true });
});

test("apply: 読めない設定は止め、何も書かない", () => {
  const paths = setup("{ broken", { theme: "dark" });
  assert.throws(() => applyPlan(paths, DEFAULT), /JSON として読めない/);
  assert.equal(readFileSync(paths.local, "utf8"), "{ broken");
  assert.equal(existsSync(path.join(paths.root, ".agent")), false);
  const badUser = setup(LEGACY, "[1]");
  assert.throws(() => applyPlan(badUser, { ...DEFAULT, bypass: true }), /JSON のオブジェクトでない/);
  assert.deepEqual(JSON.parse(readFileSync(badUser.local, "utf8")), LEGACY);
  assert.equal(existsSync(path.join(badUser.root, ".agent")), false);
});

test("show: 効いている設定ファイルと決めていること、起動のコマンドラインの設定は見えないと言う", () => {
  const paths = setup({ env: { DEVCHECK_GRANT: "on" }, enabledMcpjsonServers: ["playwright"], permissions: { deny: ["Read(./.env)"] } }, { permissions: { defaultMode: "bypassPermissions" } });
  mkdirSync(path.dirname(paths.project), { recursive: true });
  writeFileSync(paths.project, JSON.stringify({ permissions: { allow: ["WebSearch"] }, hooks: { PreToolUse: [{ hooks: [{ command: "node x/devcheck/hook.mjs" }] }], Stop: [] } }));
  const layers = showLayers(paths);
  assert.deepEqual(layers.map((l) => l.scope), ["managed", "local", "project", "user"]);
  assert.equal(layers[0].present, false);
  assert.deepEqual(layers[1].decides, ["印 DEVCHECK_GRANT=on", "deny 1 行", "MCP 有効 playwright"]);
  assert.deepEqual(layers[2].decides, ["allow 1 行", "PreToolUse のフック 1(許可の層あり)", "ほかのフック Stop"]);
  assert.deepEqual(layers[3].decides, ["defaultMode=bypassPermissions"]);
  assert.match(formatLayers(layers), /チームの道具がタブごとに渡す設定も/);
  writeFileSync(paths.local, "nope");
  assert.match(showLayers(paths)[1].decides[0], /^読めない: /);
  assert.deepEqual(decidesOf({}), ["(許可・フック・MCP に関わる項目なし)"]);
});

test("引数と 1 行の形", () => {
  assert.deepEqual(parseOptions(["--no-grant", "--drop-deny=Bash(sudo:*)", "--drop-deny=Read(./.env)", "--bypass", "--json"]), {
    grant: false,
    dropDeny: ["Bash(sudo:*)", "Read(./.env)"],
    bypass: true,
    json: true,
  });
  assert.throws(() => parseOptions(["--force"]), /知らない引数 --force/);
  assert.deepEqual(flatten({ a: [], b: {}, env: { DEVCHECK_GRANT: "on", K: "v" } }), ["a = []", "b = {}", 'env.DEVCHECK_GRANT = "on"', "env.K = (値は表示しない)"]);
});

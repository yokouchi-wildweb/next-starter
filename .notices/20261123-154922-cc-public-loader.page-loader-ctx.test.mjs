// .notices/20261123-154922-cc-public-loader.page-loader-ctx.mjs のテスト。実行: pnpm test .notices (node:test)
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { TARGET, rewrite } from "./20261123-154922-cc-public-loader.page-loader-ctx.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "20261123-154922-cc-public-loader.page-loader-ctx.mjs");
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

test("rewrite: 分割の user は getUser にし、塊の体の頭で const user = await getUser()", () => {
  const src = [
    "// 主体は public の ctx.user(既定は active だけ)",
    "export const loadX = createLoader({",
    '  access: "public",',
    "  load: async ({ user }, slug): Promise<XData> => {",
    "    if (!user) redirect(\"/login\");",
    "    return { id: user.userId, slug };",
    "  },",
    "});",
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.changed, [4]);
  assert.deepEqual(r.stopped, []);
  assert.equal(
    r.text,
    [
      "// 主体は public の getUser()(既定は active だけ)",
      "export const loadX = createLoader({",
      '  access: "public",',
      "  load: async ({ getUser }, slug): Promise<XData> => {",
      "    const user = await getUser();",
      "    if (!user) redirect(\"/login\");",
      "    return { id: user.userId, slug };",
      "  },",
      "});",
      "",
    ].join("\n"),
  );
});

test("rewrite: 式の体は塊にして return、括弧で包んだ式は外す", () => {
  const src = `export const loadY = createLoader({\n  access: "authenticated",\n  load: async ({ user }): Promise<YData> => ({ user: await requireUserRecord(user, "/login") }),\n});\n`;
  assert.equal(
    rewrite(src).text,
    `export const loadY = createLoader({\n  access: "authenticated",\n  load: async ({ getUser }): Promise<YData> => {\n    const user = await getUser();\n    return { user: await requireUserRecord(user, "/login") };\n  },\n});\n`,
  );
});

test("rewrite: allows の呼び出しは await、! の後と後ろにメンバーが続く時は括弧、値で渡す allows・既に await の物はそのまま", () => {
  const src = [
    "const parts = {",
    "  load: async ({ allows, user }, key) => {",
    "    if (!allows({ roles: [\"admin\"] })) redirect(\"/admin\");",
    "    if (allows(\"authenticated\")) go();",
    "    const ok = allows(\"public\").valueOf();",
    "    const done = await allows(\"none\");",
    "    return fetchOptions(config, { allows, user, key, ok, done });",
    "  },",
    "};",
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.changed, [2]);
  assert.equal(
    r.text,
    [
      "const parts = {",
      "  load: async ({ allows, getUser }, key) => {",
      "    const user = await getUser();",
      "    if (!(await allows({ roles: [\"admin\"] }))) redirect(\"/admin\");",
      "    if (await allows(\"authenticated\")) go();",
      "    const ok = (await allows(\"public\")).valueOf();",
      "    const done = await allows(\"none\");",
      "    return fetchOptions(config, { allows, user, key, ok, done });",
      "  },",
      "};",
      "",
    ].join("\n"),
  );
});

test("rewrite: 文脈を読まない load・新しい形は触らない(2 回目は変更 0)", () => {
  const src = [
    "export const a = createLoader({ access: \"public\", load: async (): Promise<void> => {} });",
    "export const b = createLoader({ access: \"public\", load: async (_ctx, page) => page });",
    "export const c = createLoader({",
    "  access: \"public\",",
    "  load: async ({ getUser, allows }) => {",
    "    const user = await getUser();",
    "    return (await allows(\"authenticated\")) && user;",
    "  },",
    "});",
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.stopped, []);
  assert.equal(r.text, src);
});

test("rewrite: 改名・既定値・残余・名前で受ける ctx.user・user の代入は止める(書かない)", () => {
  const src = [
    "export const a = createLoader({ access: \"public\", load: async ({ user: me }) => me });",
    "export const b = createLoader({ access: \"public\", load: async ({ user, ...rest }) => [user, rest] });",
    "export const c = createLoader({ access: \"public\", load: async (ctx) => ctx.user });",
    "export const d = createLoader({",
    "  access: \"public\",",
    "  load: async ({ user }) => {",
    "    user = null;",
    "    return user;",
    "  },",
    "});",
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.changed, []);
  assert.equal(r.text, src);
  assert.deepEqual(r.stopped.map((s) => s.line), [1, 2, 3, 6]);
});

test("rewrite: test の偽の ctx は getUser を返す関数に、コメントの load({ user } も", () => {
  const src = `// key → load({ user }, ...key) を直に呼ぶ\nconst run = () => def.load({ user: currentUser }, ...keys);\nconst none = () => def.load({ user: null }, ...keys);\n`;
  assert.equal(
    rewrite(src, { test: true }).text,
    `// key → load({ getUser }, ...key) を直に呼ぶ\nconst run = () => def.load({ getUser: async () => currentUser }, ...keys);\nconst none = () => def.load({ getUser: async () => null }, ...keys);\n`,
  );
  // test でないファイルの .load({ user: … }) は触らない
  assert.equal(rewrite(src).text, src);
});

test("rewrite: 空の load の行を消す(test のファイルは触らない)、2 回目は変更 0", () => {
  const src = `export const loadA = createLoader({\n  access: "public",\n  load: async (): Promise<void> => {},\n});\nexport const loadB = createLoader({ access: "public" });\nexport const loadC = createLoader({\n  access: "authenticated",\n  load: async () => {},\n});\n`;
  const r = rewrite(src);
  assert.deepEqual(r.changed, [3, 8]);
  assert.equal(r.text, `export const loadA = createLoader({\n  access: "public",\n});\nexport const loadB = createLoader({ access: "public" });\nexport const loadC = createLoader({\n  access: "authenticated",\n});\n`);
  assert.deepEqual(rewrite(r.text).changed, []);
  assert.equal(rewrite(src, { test: true }).text, src);
});

test("TARGET: src の ts・tsx・mts だけ", () => {
  assert.ok(TARGET.test("src/app/(user)/a/_screen/loader.ts"));
  assert.ok(TARGET.test("src/domains/x/services/server/parts.ts"));
  assert.ok(TARGET.test("src/app/a/_screen/loader.test.mts"));
  assert.ok(!TARGET.test("scripts/x/loader.ts"));
  assert.ok(!TARGET.test("src/app/a/page.mjs"));
});

test("CLI: dry-run は書かず、--apply で直し、2 回目は変更 0", () => {
  const root = mkdtempSync(join(tmpdir(), "page-loader-ctx-"));
  dirs.push(root);
  const loader = join(root, "src/app/(user)/a/_screen/loader.ts");
  const stop = join(root, "src/app/(user)/b/_screen/loader.ts");
  mkdirSync(dirname(loader), { recursive: true });
  mkdirSync(dirname(stop), { recursive: true });
  const before = `export const loadA = createLoader({\n  access: "public",\n  load: async ({ user }) => user?.userId ?? null,\n});\n`;
  writeFileSync(loader, before);
  writeFileSync(stop, `export const loadB = createLoader({ access: "public", load: async (ctx) => ctx.user });\n`);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });

  const dry = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /変更 1 か所 \/ 止めた 1 か所/);
  assert.equal(readFileSync(loader, "utf8"), before, "dry-run は書かない");

  const run = spawnSync(process.execPath, [SCRIPT, "--apply"], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(
    readFileSync(loader, "utf8"),
    `export const loadA = createLoader({\n  access: "public",\n  load: async ({ getUser }) => {\n    const user = await getUser();\n    return user?.userId ?? null;\n  },\n});\n`,
  );

  const again = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
  assert.match(again.stdout, /変更 0 か所 \/ 止めた 1 か所/);

  const bad = spawnSync(process.execPath, [SCRIPT, "--force"], { cwd: root, encoding: "utf8" });
  assert.equal(bad.status, 2);
});

// parseLoaderGuard の access の読み方(ルート地図と test:screens が共有する解析)の契約テスト。
// 実行: pnpm test src/lib/screens/checks.test.mjs (node:test。checks.mjs は依存なしの .mjs)
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkAdminPageScreen, findMarkerNamedFiles, parseLoaderGuard } from "./checks.mjs";

const HEAD = `import { createLoader } from "@/app/admin/(protected)/guard";\nimport { adminListParts, adminEditParts, adminCreateParts, adminSortParts } from "@/wiring/adminScreenParts";\n`;
const loader = (body) => parseLoaderGuard(HEAD + body);
const UNREADABLE = /access が字面で読めない/;

test("access: 組の const を 1 回束ねた <x>.access は引数まるごとの形と同じ registry に読む", () => {
  const whole = loader(`export const load = createLoader(adminListParts<Foo>("bulletin"));\n`);
  const viaConst = loader(
    `const listParts = adminListParts<Foo>("bulletin");\nexport const load = createLoader({\n  access: listParts.access,\n  load: async (ctx) => listParts.load(ctx, 1, undefined),\n});\n`,
  );
  assert.deepEqual(viaConst.problems, []);
  assert.deepEqual(viaConst.access, whole.access);
  assert.deepEqual(viaConst.access, { registry: "bulletin.search" });
});

test("access: 操作は組ごと(edit=get / create=create / sort=searchForSorting)、オプション引数・型注釈付きの const も可", () => {
  assert.deepEqual(
    loader(`const p = adminEditParts<Foo>("sample", { fallbackPath: "/admin/sample" });\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`).access,
    { registry: "sample.get" },
  );
  assert.deepEqual(
    loader(`const createParts: X = adminCreateParts("gachaMachine", { relations: domainConfig });\nexport const l = createLoader({ access: createParts.access, load: async () => 1 });\n`).access,
    { registry: "gachaMachine.create" },
  );
  assert.deepEqual(
    loader(`const s = adminSortParts("sample")\nexport const l = createLoader({ access: s.access, load: async () => 1 })\n`).access,
    { registry: "sample.searchForSorting" },
  );
});

test("access: インラインの adminXxxParts(\"d\").access も読む。allowStatuses は従来どおり", () => {
  const r = loader(`export const l = createLoader({ access: adminListParts("coupon", { where: { field: "type" } }).access, allowStatuses: ["active"], load: async () => 1 });\n`);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.access, { registry: "coupon.search" });
  assert.deepEqual(r.allowStatuses, ["active"]);
});

test("access: 証明できない形は従来どおり「字面で読めない」", () => {
  const rejected = {
    destructuring: `const { access } = adminListParts("d");\nexport const l = createLoader({ access, load: async () => 1 });\n`,
    destructuringMember: `const { parts } = make();\nexport const l = createLoader({ access: parts.access, load: async () => 1 });\n`,
    importedParts: `import { listParts } from "./parts";\nexport const l = createLoader({ access: listParts.access, load: async () => 1 });\n`,
    letBinding: `let p = adminListParts("d");\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
    reassigned: `const p = adminListParts("d");\np = other;\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
    shadowed: `const p = adminListParts("d");\nfunction f() { const p = adminListParts("e"); return p; }\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
    nonLiteralDomain: `const p = adminListParts(DOMAIN);\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
    deeperMember: `const p = adminListParts("d");\nexport const l = createLoader({ access: p.access.roles, load: async () => 1 });\n`,
    optionalChain: `const p = adminListParts("d");\nexport const l = createLoader({ access: p?.access, load: async () => 1 });\n`,
    bracket: `const p = adminListParts("d");\nexport const l = createLoader({ access: p["access"], load: async () => 1 });\n`,
    chainedDecl: `const p = adminListParts("d").withX();\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
    otherFactory: `const p = myListParts("d");\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
  };
  for (const [name, body] of Object.entries(rejected)) {
    const r = loader(body);
    assert.equal(r.access, null, name);
    // shorthand の `{ access }` は手前の「字面のオブジェクトでない」で止まる。どちらも生成失敗
    const expected = name === "destructuring" ? /字面のオブジェクトでない/ : UNREADABLE;
    assert.ok(r.problems.some((p) => expected.test(p)), `${name}: ${r.problems.join(" / ")}`);
  }
});

test("access: 組の関数を @/wiring/adminScreenParts 以外から import していれば止める", () => {
  const r = parseLoaderGuard(
    `import { createLoader } from "./guard";\nimport { adminListParts } from "@/somewhere/else";\nconst p = adminListParts("d");\nexport const l = createLoader({ access: p.access, load: async () => 1 });\n`,
  );
  assert.equal(r.access, null);
  assert.match(r.problems.join(""), /adminListParts を @\/wiring\/adminScreenParts から import していない/);
});

test("access: 字面のオブジェクトは従来どおり", () => {
  const r = loader(`export const l = createLoader({ access: { roleCategories: ["admin"] }, load: async () => 1 });\n`);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.access, { roleCategories: ["admin"] });
});

// 管理のページの Screen は AdminPage を描く(指令 17 d3)。純関数で Tier を受け取らない = fork の管理のページにも同じに効く
const ADMIN_IMPORT = `import { AdminPage } from "@/app/admin/_layout/AdminPage";\n`;
const screen = (imports, body) => `${imports}import { loadX } from "./loader";\n\nexport async function XScreen() {\n  await loadX();\n  return ${body};\n}\n`;

test("checkAdminPageScreen: AdminPage を import して描く Screen は合格(named・default・別名・相対・属性つき)", () => {
  assert.deepEqual(checkAdminPageScreen(screen(ADMIN_IMPORT, `<AdminPage title="一覧" actions={<X />}>body</AdminPage>`)), []);
  assert.deepEqual(checkAdminPageScreen(screen(`import AdminPage from "@/app/admin/_layout/AdminPage";\n`, "<AdminPage>body</AdminPage>")), []);
  assert.deepEqual(checkAdminPageScreen(screen(`import { AdminPage as Page } from "@/app/admin/_layout/AdminPage";\n`, "<Page main={false} />")), []);
  assert.deepEqual(checkAdminPageScreen(screen(`import { AdminPage } from "../../_layout/AdminPage";\n`, "<AdminPage>\n  body\n</AdminPage>")), []);
});

test("checkAdminPageScreen: AdminPage を描かない Screen は error(案内は AdminPage と frame.ts でヘッダーを隠す)", () => {
  const [problem] = checkAdminPageScreen(screen("", "<Section>body</Section>"));
  assert.match(problem, /<AdminPage> を描いていない/);
  assert.match(problem, /title="…" center=\{…\} actions=\{…\}/);
  assert.match(problem, /frame\.ts の宣言 \{ page: \{ hide: \{ header:/);
});

test("checkAdminPageScreen: import だけ・描くだけ(import 元が違う)・コメントの中だけは error", () => {
  assert.equal(checkAdminPageScreen(screen(ADMIN_IMPORT, "<Section>body</Section>")).length, 1, "import だけ");
  assert.equal(checkAdminPageScreen(screen(`import { AdminPage } from "./AdminPage";\n`, "<AdminPage>body</AdminPage>")).length, 1, "AdminPage でない同名の部品");
  assert.equal(checkAdminPageScreen(screen(ADMIN_IMPORT, "/* <AdminPage> */ <Section />")).length, 1, "コメントの中");
});

test("checkAdminPageScreen: 子の部品の中で AdminPage を描く形は読まずに error(字面で Screen のファイル自身を読む限界 = Screen が AdminPage を描く決まり)", () => {
  assert.equal(checkAdminPageScreen(screen(`import { MyAdminShell } from "../_components/MyAdminShell";\n`, "<MyAdminShell>body</MyAdminShell>")).length, 1);
});

test("1 行スイッチの既定 <名前>.default は _layout の隣でも旧い印ではない(AdminHeader の差し替えの口)、ほかの点つきの名前は印", () => {
  assert.deepEqual(
    findMarkerNamedFiles(["src/app/admin/_layout/AdminHeader.default.tsx", "src/app/admin/_layout/AdminHeader.tsx", "src/app/admin/_layout/AdminHeader.replace.tsx", "src/app/admin/_layout/AdminHeader.acme.tsx"]),
    ["src/app/admin/_layout/AdminHeader.acme.tsx"],
  );
});

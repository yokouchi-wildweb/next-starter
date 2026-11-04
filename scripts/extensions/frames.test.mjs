// 実行: pnpm test:extensions
// 枠の宣言の生成器(./frames.mjs)を一時フォルダの route の木で確かめる(指令 07 d1-d3)。
// - 試作(.frame-proto)の木: /x/[id] の宣言が /x/new に誤って効かない(静的な兄弟の行)、/x/[id]/edit・catch-all・layout の下の override
// - 親の鎖(省略 = 親のまま、false = 取り消し)と frame.override.ts(fork が勝つ、空は不在)
// - 失敗: 置き場・隣・形・ファイル名、孤立した frame.override.ts と上流の override(overrides.mjs)。全部を隠すと warn
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { matchFrame } from "../../src/app/_layout/frame/resolve.mjs";
import { headerFor, planExtensions } from "./extensions.mjs";
import { planFrames } from "./frames.mjs";
import { checkOverrides } from "./overrides.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "frames-"));
  const all = { "src/app/(user)/layout.tsx": "export default 1;\n", "src/app/admin/layout.tsx": "export default 1;\n", ...files };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const page = "export default function Page() { return null; }\n";
const frame = (value) => `import type { FrameDeclaration } from "@/app/_layout/frame";\n\nexport const frame = ${JSON.stringify(value)} satisfies FrameDeclaration;\n`;
const override = (value) => `export const override = ${JSON.stringify(value)};\n`;
const both = { sp: true, pc: true };
const U = "src/app/(user)/(public)/frame-proto";

function withTree(files, fn) {
  const root = tree(files);
  try {
    return fn(root, planFrames(root, headerFor));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("試作の木: 宣言のあるルートだけの表は /x/new に /x/[id] の宣言を当てる、生成した表は静的な兄弟の行で当てない", () => {
  withTree(
    {
      [`${U}/static/page.tsx`]: page,
      [`${U}/static/frame.ts`]: frame({ hide: { footer: both } }),
      [`${U}/device/page.tsx`]: page,
      [`${U}/device/frame.ts`]: frame({ hide: { footer: { sp: true } } }),
      [`${U}/x/[id]/page.tsx`]: page,
      [`${U}/x/[id]/frame.ts`]: frame({ hide: { footer: both } }),
      [`${U}/x/new/page.tsx`]: page,
      [`${U}/x/[id]/edit/page.tsx`]: page,
      [`${U}/c/[...slug]/page.tsx`]: page,
      [`${U}/c/[...slug]/frame.ts`]: frame({ hide: { bottomNav: both } }),
      [`${U}/layouted/layout.tsx`]: page,
      [`${U}/layouted/page.tsx`]: page,
      [`${U}/layouted/frame.ts`]: frame({ hide: { header: both } }),
      [`${U}/layouted/child/page.tsx`]: page,
      [`${U}/layouted/override/page.tsx`]: page,
      [`${U}/layouted/override/frame.ts`]: frame({ hide: { header: { pc: false } } }),
      [`${U}/plain/page.tsx`]: page,
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      const rows = plan.tables.user;
      const at = (...segments) => matchFrame(["(public)", "frame-proto", ...segments], rows).hide;
      const sparse = rows.filter((r) => r.pattern.join("/") !== "(public)/frame-proto/x/new");
      assert.deepEqual(matchFrame(["(public)", "frame-proto", "x", "new"], sparse).hide, ["footer-sp", "footer-pc"], "宣言のあるルートだけの表は誤る(試作 Q5)");
      assert.deepEqual(rows.find((r) => r.pattern.join("/") === "(public)/frame-proto/x/new"), { pattern: ["(public)", "frame-proto", "x", "new"], scope: "page", hide: [], fill: false }, "静的な兄弟の空の行");
      assert.deepEqual(at("x", "new"), []);
      assert.deepEqual(at("x", "123"), ["footer-sp", "footer-pc"]);
      assert.deepEqual(at("x", "123", "edit"), [], "長さの違う /x/123/edit には当たらない");
      assert.deepEqual(at("static"), ["footer-sp", "footer-pc"]);
      assert.deepEqual(at("device"), ["footer-sp"]);
      assert.deepEqual(at("c", "a/b"), ["bottom-nav-sp", "bottom-nav-pc"]);
      assert.deepEqual(at("layouted"), ["header-sp", "header-pc"]);
      assert.deepEqual(at("layouted", "child"), ["header-sp", "header-pc"], "layout の宣言は下全部");
      assert.deepEqual(at("layouted", "override"), ["header-sp"], "子の false は親の取り消し");
      assert.deepEqual(at("plain"), []);
      assert.equal(rows.length, 7, "宣言 6 + 静的な兄弟 1");
      assert.equal(plan.declarations, 6);
    },
  );
});

test("親の鎖: 静的な兄弟の行は祖先の値を持つ・page の宣言は自分だけ・枠の根の宣言は枠の全体", () => {
  withTree(
    {
      "src/app/(user)/frame.ts": frame({ hide: { bottomNav: both } }),
      "src/app/(user)/(protected)/layout.tsx": page,
      "src/app/(user)/(protected)/frame.ts": frame({ hide: { bottomNav: { sp: false } } }),
      "src/app/(user)/(protected)/x/[id]/page.tsx": page,
      "src/app/(user)/(protected)/x/[id]/frame.ts": frame({ hide: { footer: both }, fill: true }),
      "src/app/(user)/(protected)/x/new/page.tsx": page,
      "src/app/(user)/(protected)/a/page.tsx": page,
      "src/app/(user)/(protected)/a/frame.ts": frame({ hide: { header: { sp: true } } }),
      "src/app/(user)/(protected)/a/b/page.tsx": page,
      "src/app/admin/(protected)/layout.tsx": page,
      "src/app/admin/(protected)/frame.ts": frame({ hide: { sidebar: { sp: true } } }),
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      const user = (...s) => matchFrame(s, plan.tables.user);
      assert.deepEqual(user("(auth)", "login"), { hide: ["bottom-nav-sp", "bottom-nav-pc"], fill: false });
      assert.deepEqual(user("(protected)", "x", "1"), { hide: ["footer-sp", "footer-pc", "bottom-nav-pc"], fill: true });
      assert.deepEqual(user("(protected)", "x", "new"), { hide: ["bottom-nav-pc"], fill: false }, "静的な兄弟 = 祖先の値");
      assert.deepEqual(user("(protected)", "a").hide, ["header-sp", "bottom-nav-pc"]);
      assert.deepEqual(user("(protected)", "a", "b").hide, ["bottom-nav-pc"], "page の宣言は下に効かない");
      assert.deepEqual(matchFrame(["(protected)", "users"], plan.tables.admin).hide, ["admin-sidebar-sp"]);
      assert.match(plan.outputs["src/app/admin/_layout/extensions/frameTable.ts"], /scope: "layout", hide: \["admin-sidebar-sp"\]/);
    },
  );
});

test("frame.override.ts: 上流の宣言に部位と端末ごとに重なり fork が勝つ・frame.ts の無いページにも効く・空は不在", () => {
  withTree(
    {
      "src/app/(user)/a/page.tsx": page,
      "src/app/(user)/a/frame.ts": frame({ hide: { footer: both, header: { sp: true } } }),
      "src/app/(user)/a/frame.override.ts": override({ hide: { footer: { pc: false }, bottomNav: { sp: true } } }),
      "src/app/(user)/b/page.tsx": page,
      "src/app/(user)/b/frame.override.ts": override({ fill: true }),
      "src/app/(user)/c/page.tsx": page,
      "src/app/(user)/c/frame.ts": frame({ hide: { footer: { sp: true } } }),
      "src/app/(user)/c/frame.override.ts": "// 親の上書きを空にした\n",
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      assert.deepEqual(matchFrame(["a"], plan.tables.user).hide, ["header-sp", "footer-sp", "bottom-nav-sp"]);
      assert.deepEqual(matchFrame(["b"], plan.tables.user), { hide: [], fill: true });
      assert.deepEqual(matchFrame(["c"], plan.tables.user).hide, ["footer-sp"]);
    },
  );
});

test("失敗: 枠の外・隣に page / layout が無い・private / @slot / intercepting・形の違う値・宣言にない部位・リテラルでない値・別のファイル名", () => {
  withTree(
    {
      "src/app/(marketing)/lp/page.tsx": page,
      "src/app/(marketing)/lp/frame.ts": frame({}),
      "src/app/(user)/(public)/frame.ts": frame({}),
      "src/app/(user)/(public)/n/page.tsx": page,
      "src/app/(user)/_parts/frame.ts": frame({}),
      "src/app/(user)/@modal/m/page.tsx": page,
      "src/app/(user)/@modal/m/frame.ts": frame({}),
      "src/app/(user)/(.)photo/page.tsx": page,
      "src/app/(user)/(.)photo/frame.ts": frame({}),
      "src/app/(user)/v/page.tsx": page,
      "src/app/(user)/v/frame.ts": frame({ hide: { footer: true } }),
      "src/app/(user)/k/page.tsx": page,
      "src/app/(user)/k/frame.ts": frame({ hide: { sidebar: both } }),
      "src/app/(user)/e/page.tsx": page,
      "src/app/(user)/e/frame.ts": "const x = true;\nexport const frame = { fill: x };\n",
      "src/app/(user)/t/page.tsx": page,
      "src/app/(user)/t/frame.tsx": frame({}),
      "src/app/(user)/w/page.tsx": page,
      "src/app/(user)/w/frame.ts": "export const notFrame = {};\n",
    },
    (_root, plan) => {
      const has = (path, re) => assert.ok(plan.problems.some((p) => p.startsWith(path) && re.test(p)), `${path} ${re}\n${plan.problems.join("\n")}`);
      has("src/app/(marketing)/lp/frame.ts", /枠の layout の下だけ/);
      has("src/app/(user)/(public)/frame.ts", /page\.tsx か layout\.tsx が要る/);
      has("src/app/(user)/_parts/frame.ts", /private/);
      has("src/app/(user)/@modal/m/frame.ts", /@slot/);
      has("src/app/(user)/(.)photo/frame.ts", /intercepting/);
      has("src/app/(user)/v/frame.ts", /\{ sp\?: boolean, pc\?: boolean \}/);
      has("src/app/(user)/k/frame.ts", /この枠の部位でない/);
      has("src/app/(user)/e/frame.ts", /リテラルでない値/);
      has("src/app/(user)/t/frame.tsx", /枠の宣言は frame\.ts/);
      has("src/app/(user)/w/frame.ts", /export const frame = \{ … \} が無い/);
      assert.equal(plan.problems.length, 10);
    },
  );
});

test("孤立した frame.override.ts(隣に frame.ts も page / layout も無い)は失敗、上流(Tier1)は frame.override.ts を出荷しない", () => {
  const root = tree({
    "src/app/(user)/a/page.tsx": page,
    "src/app/(user)/a/frame.override.ts": override({}),
    "src/app/(user)/(g)/x/page.tsx": page,
    "src/app/(user)/(g)/frame.override.ts": override({}),
    "src/app/(user)/l/layout.tsx": page,
    "src/app/(user)/l/frame.override.ts": override({}),
  });
  try {
    const fork = checkOverrides(root, { isTier1: false });
    assert.deepEqual(fork.problems, ["src/app/(user)/(g)/frame.override.ts: 隣に上書きの対象 frame が無い(孤立した override。対象の名前に合わせるか消す)"]);
    const tier1 = checkOverrides(root, { isTier1: true });
    assert.equal(tier1.problems.filter((p) => /上流\(Tier1\)は override を出荷しない/.test(p)).length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("全部の部位を隠す宣言は warn でルートグループを案内し、止めない", () => {
  withTree(
    {
      "src/app/(user)/game/page.tsx": page,
      "src/app/(user)/game/frame.ts": frame({ hide: { header: both, headerNav: both, footer: both, bottomNav: both } }),
      "src/app/(user)/half/page.tsx": page,
      "src/app/(user)/half/frame.ts": frame({ hide: { header: both, headerNav: both, footer: both, bottomNav: { sp: true } } }),
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      assert.equal(plan.warnings.length, 1);
      assert.match(plan.warnings[0], /^src\/app\/\(user\)\/game\/frame\.ts: 枠の部位を全部隠している\(.*ルートグループ/);
    },
  );
});

test("宣言が無ければ表は空(上流の今)、枠の根が無いリポは表を書かない", () => {
  withTree({ "src/app/(user)/a/page.tsx": page }, (_root, plan) => {
    assert.deepEqual(plan.tables, { user: [], admin: [] });
    assert.match(plan.outputs["src/app/(user)/_layout/extensions/frameTable.ts"], /^\/\/ 生成物・編集不可: pnpm extensions:generate が src\/app\/\(user\) の frame\.ts/);
    assert.match(plan.outputs["src/app/(user)/_layout/extensions/frameTable.ts"], /export const frameTable = \[\] as const satisfies FrameTable;/);
  });
  const bare = mkdtempSync(join(tmpdir(), "frames-"));
  try {
    assert.deepEqual(planFrames(bare, headerFor).outputs, {});
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test("このリポ: 上流は frame.ts を出荷していない → 表は空、宣言 0", () => {
  const plan = planExtensions(repoRoot);
  assert.deepEqual(plan.frames, { tables: 2, declarations: 0 });
  assert.deepEqual(plan.warnings, []);
  assert.match(plan.outputs["src/app/admin/_layout/extensions/frameTable.ts"], /export const frameTable = \[\] as const/);
});

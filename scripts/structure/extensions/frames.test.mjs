// 実行: pnpm test:extensions
// 枠の宣言の生成器(./frames.mjs)を一時フォルダの route の木で確かめる(指令 07 d1-d3、指令 08 AMENDMENT 1・2)。
// - 試作(.frame-proto)の木: /x/[id] の宣言が /x/new に誤って効かない(静的な兄弟の行)、/x/[id]/edit・catch-all・layout の下の子
// - 範囲はキー(layout / page)、名前の対 frame.default.ts(既定)/ frame.ts(既定の上に重なる)、重ねる順の全部の組み合わせ
// - 失敗: 置き場・隣・形・キー・ファイル名(frame.override.ts など)・上流(Tier1)の frame.ts。全部を隠すと warn
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { matchFrame } from "../../../src/app/_layout/frame/resolve.mjs";
import { headerFor, planExtensions } from "./extensions.mjs";
import { planFrames } from "./frames.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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
const frameDefault = (value) => `import type { FrameDeclaration } from "@/app/_layout/frame";\n\nexport const frameDefault = ${JSON.stringify(value)} satisfies FrameDeclaration;\n`;
const both = { sp: true, pc: true };
const U = "src/app/(user)/(public)/frame-proto";

function withTree(files, fn, identity = { isTier1: false }) {
  const root = tree(files);
  try {
    return fn(root, planFrames(root, headerFor, identity));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("試作の木: 宣言のあるルートだけの表は /x/new に /x/[id] の宣言を当てる、生成した表は静的な兄弟の行で当てない", () => {
  withTree(
    {
      [`${U}/static/page.tsx`]: page,
      [`${U}/static/frame.default.ts`]: frameDefault({ page: { hide: { footer: both } } }),
      [`${U}/device/page.tsx`]: page,
      [`${U}/device/frame.default.ts`]: frameDefault({ page: { hide: { footer: { sp: true } } } }),
      [`${U}/x/[id]/page.tsx`]: page,
      [`${U}/x/[id]/frame.default.ts`]: frameDefault({ page: { hide: { footer: both } } }),
      [`${U}/x/new/page.tsx`]: page,
      [`${U}/x/[id]/edit/page.tsx`]: page,
      [`${U}/c/[...slug]/page.tsx`]: page,
      [`${U}/c/[...slug]/frame.default.ts`]: frameDefault({ page: { hide: { bottomNav: both } } }),
      [`${U}/layouted/layout.tsx`]: page,
      [`${U}/layouted/page.tsx`]: page,
      [`${U}/layouted/frame.default.ts`]: frameDefault({ layout: { hide: { header: both } } }),
      [`${U}/layouted/child/page.tsx`]: page,
      [`${U}/layouted/override/page.tsx`]: page,
      [`${U}/layouted/override/frame.default.ts`]: frameDefault({ page: { hide: { header: { pc: false } } } }),
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
      assert.deepEqual(at("layouted", "child"), ["header-sp", "header-pc"], "layout: は下全部");
      assert.deepEqual(at("layouted", "override"), ["header-sp"], "子の false は親の取り消し");
      assert.deepEqual(at("plain"), []);
      assert.equal(rows.length, 7, "宣言 6 + 静的な兄弟 1");
      assert.equal(plan.declarations, 6);
    },
  );
});

test("範囲はキー: layout と page を同じフォルダに書ける、page は子に継がない、トップページ / の page.fill", () => {
  withTree(
    {
      "src/app/(user)/page.tsx": page,
      "src/app/(user)/frame.default.ts": frameDefault({ layout: { hide: { bottomNav: { pc: true } } }, page: { fill: true } }),
      "src/app/(user)/(protected)/layout.tsx": page,
      "src/app/(user)/(protected)/page.tsx": page,
      "src/app/(user)/(protected)/frame.default.ts": frameDefault({ page: { hide: { footer: both } } }),
      "src/app/(user)/(protected)/x/[id]/page.tsx": page,
      "src/app/(user)/(protected)/x/[id]/frame.default.ts": frameDefault({ page: { hide: { header: { sp: true } } } }),
      "src/app/(user)/(protected)/x/new/page.tsx": page,
      "src/app/(user)/(protected)/a/page.tsx": page,
      "src/app/admin/(protected)/layout.tsx": page,
      "src/app/admin/(protected)/frame.default.ts": frameDefault({ layout: { hide: { sidebar: { sp: true } } } }),
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      const user = (...s) => matchFrame(s, plan.tables.user);
      assert.deepEqual(user(), { hide: ["bottom-nav-pc"], fill: true }, "/ = layout の値 + page の fill");
      assert.deepEqual(user("(auth)", "login"), { hide: ["bottom-nav-pc"], fill: false }, "page の fill は子に継がない");
      assert.deepEqual(user("(protected)"), { hide: ["footer-sp", "footer-pc", "bottom-nav-pc"], fill: false });
      assert.deepEqual(user("(protected)", "a").hide, ["bottom-nav-pc"], "(protected) の page: は子に効かない");
      assert.deepEqual(user("(protected)", "x", "1").hide, ["header-sp", "bottom-nav-pc"]);
      assert.deepEqual(user("(protected)", "x", "new").hide, ["bottom-nav-pc"], "静的な兄弟 = 祖先の layout の値");
      assert.deepEqual(matchFrame(["(protected)", "users"], plan.tables.admin).hide, ["admin-sidebar-sp"]);
      assert.match(plan.outputs["src/app/admin/_layout/extensions/frameTable.ts"], /scope: "layout", hide: \["admin-sidebar-sp"\]/);
    },
  );
});

test("重ねる順(全部の組み合わせ): 祖先の layout(既定 → frame)→ 葉の layout(既定 → frame)→ 葉の page(既定 → frame)、後が勝つ", () => {
  // 6 つの節(祖先 layout の既定・frame、葉 layout の既定・frame、葉 page の既定・frame)の有無の全部の組み合わせで、
  // 同じ部位と端末(footer.sp)に交互の値を書き、勝つのは並びで最後の節であることを確かめる
  const slots = [
    ["anc", "default", "layout"],
    ["anc", "frame", "layout"],
    ["leaf", "default", "layout"],
    ["leaf", "frame", "layout"],
    ["leaf", "default", "page"],
    ["leaf", "frame", "page"],
  ];
  for (let mask = 1; mask < 1 << slots.length; mask += 1) {
    const used = slots.map((slot, i) => ({ slot, on: (mask >> i) & 1, value: i % 2 === 0 }));
    const decl = { anc: { default: {}, frame: {} }, leaf: { default: {}, frame: {} } };
    for (const { slot: [where, name, scope], on, value } of used) if (on) decl[where][name][scope] = { hide: { footer: { sp: value } } };
    const files = {
      "src/app/(user)/a/layout.tsx": page,
      "src/app/(user)/a/b/layout.tsx": page,
      "src/app/(user)/a/b/page.tsx": page,
    };
    for (const where of ["anc", "leaf"]) {
      const dir = where === "anc" ? "src/app/(user)/a" : "src/app/(user)/a/b";
      if (Object.keys(decl[where].default).length > 0) files[`${dir}/frame.default.ts`] = frameDefault(decl[where].default);
      if (Object.keys(decl[where].frame).length > 0) files[`${dir}/frame.ts`] = frame(decl[where].frame);
    }
    const winner = used.filter((u) => u.on).at(-1);
    withTree(files, (_root, plan) => {
      assert.deepEqual(plan.problems, [], `mask ${mask}`);
      assert.deepEqual(matchFrame(["a", "b"], plan.tables.user).hide, winner.value ? ["footer-sp"] : [], `mask ${mask}: 勝つのは ${winner.slot.join(".")}`);
    });
  }
});

test("frame.ts は既定の上に重なる(部位と端末ごと、下のリポが勝つ)・既定の無いルートにも書ける・空は不在", () => {
  withTree(
    {
      "src/app/(user)/a/page.tsx": page,
      "src/app/(user)/a/frame.default.ts": frameDefault({ page: { hide: { footer: both, header: { sp: true } } } }),
      "src/app/(user)/a/frame.ts": frame({ page: { hide: { footer: { pc: false }, bottomNav: { sp: true } } } }),
      "src/app/(user)/b/page.tsx": page,
      "src/app/(user)/b/frame.ts": frame({ page: { fill: true } }),
      "src/app/(user)/c/page.tsx": page,
      "src/app/(user)/c/frame.default.ts": frameDefault({ page: { hide: { footer: { sp: true } } } }),
      "src/app/(user)/c/frame.ts": "// 既定のまま\n",
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      assert.deepEqual(matchFrame(["a"], plan.tables.user).hide, ["header-sp", "footer-sp", "bottom-nav-sp"]);
      assert.deepEqual(matchFrame(["b"], plan.tables.user), { hide: [], fill: true });
      assert.deepEqual(matchFrame(["c"], plan.tables.user).hide, ["footer-sp"]);
    },
  );
});

test("失敗: 枠の外・隣に layout / page が無い・layout: / page: の相手が無い・キーが無い・知らないキー・private / @slot / intercepting・形・名前", () => {
  withTree(
    {
      "src/app/(marketing)/lp/page.tsx": page,
      "src/app/(marketing)/lp/frame.ts": frame({ page: {} }),
      "src/app/(user)/(public)/frame.ts": frame({ layout: {} }),
      "src/app/(user)/(public)/n/page.tsx": page,
      "src/app/(user)/p/page.tsx": page,
      "src/app/(user)/p/frame.ts": frame({ layout: { fill: true } }),
      "src/app/(user)/l/layout.tsx": page,
      "src/app/(user)/l/frame.ts": frame({ page: { fill: true } }),
      "src/app/(user)/z/page.tsx": page,
      "src/app/(user)/z/frame.ts": frame({}),
      "src/app/(user)/u/page.tsx": page,
      "src/app/(user)/u/frame.ts": frame({ hide: { footer: both } }),
      "src/app/(user)/_parts/frame.ts": frame({ page: {} }),
      "src/app/(user)/@modal/m/page.tsx": page,
      "src/app/(user)/@modal/m/frame.ts": frame({ page: {} }),
      "src/app/(user)/(.)photo/page.tsx": page,
      "src/app/(user)/(.)photo/frame.ts": frame({ page: {} }),
      "src/app/(user)/v/page.tsx": page,
      "src/app/(user)/v/frame.ts": frame({ page: { hide: { footer: true } } }),
      "src/app/(user)/k/page.tsx": page,
      "src/app/(user)/k/frame.ts": frame({ page: { hide: { sidebar: both } } }),
      "src/app/(user)/e/page.tsx": page,
      "src/app/(user)/e/frame.ts": "const x = true;\nexport const frame = { page: { fill: x } };\n",
      "src/app/(user)/w/page.tsx": page,
      "src/app/(user)/w/frame.ts": "export const frameDefault = { page: {} };\n",
      "src/app/(user)/t/page.tsx": page,
      "src/app/(user)/t/frame.tsx": frame({ page: {} }),
      "src/app/(user)/o/page.tsx": page,
      "src/app/(user)/o/frame.override.ts": "export const override = { page: {} };\n",
      "src/app/(user)/q/page.tsx": page,
      "src/app/(user)/q/frame.acme.ts": frame({ page: {} }),
    },
    (_root, plan) => {
      const has = (path, re) => assert.ok(plan.problems.some((p) => p.startsWith(path) && re.test(p)), `${path} ${re}\n${plan.problems.join("\n")}`);
      has("src/app/(marketing)/lp/frame.ts", /枠の layout の下だけ/);
      has("src/app/(user)/(public)/frame.ts", /layout\.tsx か page\.tsx が要る/);
      has("src/app/(user)/p/frame.ts", /layout: は隣に layout\.tsx があるフォルダだけ/);
      has("src/app/(user)/l/frame.ts", /page: は隣に page\.tsx があるフォルダだけ/);
      has("src/app/(user)/z/frame.ts", /範囲のキーが無い/);
      has("src/app/(user)/u/frame.ts", /未知のキー hide/);
      has("src/app/(user)/_parts/frame.ts", /private/);
      has("src/app/(user)/@modal/m/frame.ts", /@slot/);
      has("src/app/(user)/(.)photo/frame.ts", /intercepting/);
      has("src/app/(user)/v/frame.ts", /page: hide\.footer は \{ sp\?: boolean, pc\?: boolean \}/);
      has("src/app/(user)/k/frame.ts", /この枠の部位でない/);
      has("src/app/(user)/e/frame.ts", /リテラルでない値/);
      has("src/app/(user)/w/frame.ts", /export const frame = \{ … \} が無い/);
      has("src/app/(user)/t/frame.tsx", /frame\.default\.ts.*か frame\.ts.*だけ/);
      has("src/app/(user)/o/frame.override.ts", /frame\.default\.ts.*か frame\.ts.*だけ/);
      has("src/app/(user)/q/frame.acme.ts", /frame\.default\.ts.*か frame\.ts.*だけ/);
      assert.equal(plan.problems.length, 16);
    },
  );
});

test("上流(Tier1)は frame.ts を持たない(既定は frame.default.ts)。fork と中間 Tier は frame.default.ts も frame.ts も持てる", () => {
  const files = {
    "src/app/(user)/a/page.tsx": page,
    "src/app/(user)/a/frame.default.ts": frameDefault({ page: { fill: true } }),
    "src/app/(user)/b/page.tsx": page,
    "src/app/(user)/b/frame.ts": frame({ page: { fill: true } }),
  };
  withTree(files, (_root, plan) => {
    assert.deepEqual(plan.problems, ["src/app/(user)/b/frame.ts: 上流(Tier1)は frame.ts を持たない(ルートを作ったリポの既定は隣の frame.default.ts、export const frameDefault)"]);
  }, { isTier1: true });
  withTree(files, (_root, plan) => assert.deepEqual(plan.problems, []), { isTier1: false });
});

test("全部の部位を隠す宣言は warn でルートグループを案内し、止めない", () => {
  withTree(
    {
      "src/app/(user)/game/page.tsx": page,
      "src/app/(user)/game/frame.default.ts": frameDefault({ page: { hide: { header: both, headerNav: both, footer: both, bottomNav: both } } }),
      "src/app/(user)/half/page.tsx": page,
      "src/app/(user)/half/frame.default.ts": frameDefault({ page: { hide: { header: both, headerNav: both, footer: both, bottomNav: { sp: true } } } }),
    },
    (_root, plan) => {
      assert.deepEqual(plan.problems, []);
      assert.equal(plan.warnings.length, 1);
      assert.match(plan.warnings[0], /^src\/app\/\(user\)\/game\/frame\.default\.ts\(page\): 枠の部位を全部隠している\(.*ルートグループ/);
    },
  );
});

test("宣言が無ければ表は空、枠の根が無いリポは表を書かない", () => {
  withTree({ "src/app/(user)/a/page.tsx": page }, (_root, plan) => {
    assert.deepEqual(plan.tables, { user: [], admin: [] });
    assert.match(plan.outputs["src/app/(user)/_layout/extensions/frameTable.ts"], /^\/\/ 生成物・編集不可: pnpm extensions:generate が src\/app\/\(user\) の frame\.default\.ts \/ frame\.ts/);
    assert.match(plan.outputs["src/app/(user)/_layout/extensions/frameTable.ts"], /export const frameTable = \[\] as const satisfies FrameTable;/);
  });
  const bare = mkdtempSync(join(tmpdir(), "frames-"));
  try {
    assert.deepEqual(planFrames(bare, headerFor, { isTier1: false }).outputs, {});
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test("このリポ: 枠の根 2 つの表を書く", () => {
  const plan = planExtensions(repoRoot);
  assert.equal(plan.frames.tables, 2);
  assert.ok("src/app/(user)/_layout/extensions/frameTable.ts" in plan.outputs);
  assert.ok("src/app/admin/_layout/extensions/frameTable.ts" in plan.outputs);
});

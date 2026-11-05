// 実行: pnpm test:codemods
// 管理ヘッダーへ移す道具(./admin-header.mjs)の書き換え・止める一覧・区切りの決め方
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { STOP_KINDS, detectCheckpoint, planAdminHeader, rewriteAdminHeader, scanText } from "./admin-header.mjs";

const SCREEN = "src/app/admin/(protected)/things/_components/ThingListScreen.tsx";
const PAGE = `import AdminPage from "@/app/admin/_layout/AdminPage";\n`;
const TITLE = `import PageTitle from "@/app/admin/_layout/PageTitle";\n`;
const kinds = (rows) => rows.map((r) => r.kind);

test("題: AdminPage の最初の子の PageTitle(placement 無し / header)を title へ、PageTitle と import を消す", () => {
  const out = rewriteAdminHeader(
    SCREEN,
    `${PAGE}${TITLE}\nexport function S() {\n  return (\n    <AdminPage>\n      <PageTitle placement="header">物の一覧</PageTitle>\n      <List />\n    </AdminPage>\n  );\n}\n`,
  );
  assert.equal(out.text, `${PAGE}\nexport function S() {\n  return (\n    <AdminPage title="物の一覧">\n      <List />\n    </AdminPage>\n  );\n}\n`);
  assert.deepEqual(kinds(out.changes), ["title"]);
  assert.deepEqual(out.stops, []);
  const bare = rewriteAdminHeader(SCREEN, `${PAGE}${TITLE}const x = <AdminPage>\n  <PageTitle>{label}</PageTitle>\n</AdminPage>;\n`);
  assert.equal(bare.text, `${PAGE}const x = <AdminPage title={label}>\n</AdminPage>;\n`);
});

test("題: 最初の子の <Stack> の最初の子も移す(上流のダッシュボードと同じ)、引用符を含む題は {\"…\"}", () => {
  const out = rewriteAdminHeader(SCREEN, `${PAGE}${TITLE}const x = (\n  <AdminPage>\n    <Stack space={8}>\n      <PageTitle>"特別" な一覧</PageTitle>\n      <Body />\n    </Stack>\n  </AdminPage>\n);\n`);
  assert.match(out.text, /<AdminPage title=\{"\\"特別\\" な一覧"\}>/);
  assert.doesNotMatch(out.text, /PageTitle/);
});

test("クーポンのタブ: AdminPage の直接の子の placement=\"header\" を center へ(題と一緒でも)", () => {
  const out = rewriteAdminHeader(
    SCREEN,
    `${PAGE}${TITLE}import { CouponSectionTabs } from "../../_screen/CouponSectionTabs";\nconst x = (\n  <AdminPage>\n    <PageTitle placement="header">クーポン</PageTitle>\n    <CouponSectionTabs placement="header" />\n    <List />\n  </AdminPage>\n);\n`,
  );
  assert.match(out.text, /<AdminPage title="クーポン" center=\{<CouponSectionTabs variant="header" \/>\}>\n {4}<List \/>/);
  assert.deepEqual(kinds(out.changes), ["title", "coupon-tabs-center"]);
  assert.match(out.text, /import \{ CouponSectionTabs \}/, "タブの import は残る");
});

test("題で止める: placement=\"page\"・最初の子でない・ほかの props・子が部品・AdminPage に title がある・AdminPage の外", () => {
  const cases = [
    `<AdminPage><PageTitle placement="page">x</PageTitle></AdminPage>`,
    `<AdminPage><Intro /><PageTitle>x</PageTitle></AdminPage>`,
    `<AdminPage><PageTitle className="mb-2">x</PageTitle></AdminPage>`,
    `<AdminPage><PageTitle><Icon /> x</PageTitle></AdminPage>`,
    `<AdminPage title="a"><PageTitle>x</PageTitle></AdminPage>`,
    `<Section><PageTitle>x</PageTitle></Section>`,
    `<AdminPage><Flex><PageTitle>x</PageTitle></Flex></AdminPage>`,
  ];
  for (const body of cases) {
    const out = rewriteAdminHeader(SCREEN, `${PAGE}${TITLE}const x = ${body};\n`);
    assert.equal(out.text, null, body);
    assert.deepEqual(kinds(out.stops), ["page-title-in-body"], body);
  }
});

test("クーポンのタブで止める: AdminPage に center がある・ほかの props", () => {
  const imp = `import { CouponSectionTabs } from "./CouponSectionTabs";\n`;
  for (const body of [`<AdminPage center={<X />}><CouponSectionTabs placement="header" /></AdminPage>`, `<AdminPage><CouponSectionTabs placement="header" className="x" /></AdminPage>`]) {
    const out = rewriteAdminHeader(SCREEN, `${PAGE}${imp}const x = ${body};\n`);
    assert.deepEqual(kinds(out.stops), ["coupon-tabs-placement"], body);
  }
});

test("止める: portal の slot ごと(features の中は案内つき)・useItemNavigator・ItemNavigator の消えた props・AdminLayout の header・受け口の部品の import", () => {
  const out = rewriteAdminHeader(
    "src/features/thing/components/AdminThingPanel.tsx",
    [
      `import { AdminHeaderPortal } from "@/components/AppFrames/Admin/Elements/AdminHeaderPortal";`,
      `import { ItemNavigator, useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";`,
      `import { AdminLayout } from "@/app/admin/_layout/AdminLayout";`,
      `import { AdminHeaderSlots } from "@/app/admin/_layout/HeaderSlots";`,
      `const nav = useItemNavigator({ items, currentItem, getPath, methods, updateTrigger });`,
      `const a = <AdminHeaderPortal slot="center"><Search /></AdminHeaderPortal>;`,
      `const b = <AdminHeaderPortal slot="right"><Button /></AdminHeaderPortal>;`,
      `const c = <AdminHeaderPortal slot="title"><h1>x</h1></AdminHeaderPortal>;`,
      `const d = <ItemNavigator items={items} currentId="1" getPath={p} getLabel={l} usePortal slot="right" />;`,
      `const e = <AdminLayout header={<MyHeader />}>{children}</AdminLayout>;`,
      ``,
    ].join("\n"),
  );
  assert.equal(out.text, null);
  assert.deepEqual(kinds(out.stops).sort(), ["admin-layout-header-prop", "admin-layout-header-prop", "item-navigator", "item-navigator", "portal-center", "portal-right", "portal-title"]);
  assert.match(out.stops.find((s) => s.kind === "portal-center").detail, /route の Screen が組む/);
});

test("文字で止める: 受け口の id(CSS・定数)・自前の beforeunload・自前の守りの定義と import(守りの lib の読み手は止めない)", () => {
  assert.deepEqual(kinds(scanText("src/styles/overrides.css", `#admin-header-center-slot { gap: 1rem; }\n`)), ["slot-id-css"]);
  assert.deepEqual(kinds(scanText("src/features/x/a.ts", `import { ADMIN_HEADER_RIGHT_SLOT_ID } from "@/components/AppFrames/constants";\n`)), ["slot-id-css"]);
  assert.deepEqual(
    kinds(
      scanText(
        "src/hooks/useUnsavedChangesGuard.ts",
        `export function useUnsavedChangesGuard({ when }) {\n  window.addEventListener("beforeunload", onBeforeUnload);\n  return () => window.removeEventListener("beforeunload", onBeforeUnload);\n}\n`,
      ),
    ),
    ["own-unsaved-guard", "own-unsaved-guard"],
  );
  assert.deepEqual(kinds(scanText("src/app/x/Form.tsx", `import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";\n`)), ["own-unsaved-guard"]);
  assert.deepEqual(scanText("src/app/x/Form.tsx", `import { useUnsavedGuard } from "@/lib/unsavedGuard";\nconst g = useUnsavedGuard(isDirty);\n`), []);
  assert.deepEqual(scanText("src/styles/overrides.css", `[data-slot="admin-header-center"] { gap: 1rem; }\n`), []);
});

/** 写しの fork(一時フォルダ)を作る */
function fork(files) {
  const root = mkdtempSync(join(tmpdir(), "admin-header-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("区切り: AdminPage の title が無ければ止まる、互換の portal が残っていれば band(期限 portal)、消えていれば portal(期限 今)", () => {
  const before = fork({ "src/app/admin/_layout/AdminPage.tsx": "x" });
  const band = fork({ "src/app/admin/_layout/AdminPageTitle.tsx": "x", "src/components/AppFrames/Admin/Elements/AdminHeaderPortal.tsx": "x" });
  const portal = fork({ "src/app/admin/_layout/AdminPageTitle.tsx": "x" });
  try {
    assert.match(detectCheckpoint(before).problem, /帯の版を取り込んでいない/);
    assert.deepEqual(detectCheckpoint(band), { checkpoint: "band" });
    assert.deepEqual(detectCheckpoint(portal), { checkpoint: "portal" });
  } finally {
    for (const root of [before, band, portal]) rmSync(root, { recursive: true, force: true });
  }
});

test("リポ全体: fork が足したファイルだけ、テストは触らない、AdminPage を描かない管理の Screen を止める、もう一度走らせても変わらない、止める物は閉じた種類と移し先つき", () => {
  const upstream = "src/app/admin/(protected)/up/_screen/UpScreen.tsx";
  const root = fork({
    "src/app/admin/_layout/AdminPageTitle.tsx": "x",
    [upstream]: `${PAGE}${TITLE}const x = <AdminPage><PageTitle>上流</PageTitle></AdminPage>;\n`,
    [SCREEN]: `${PAGE}${TITLE}export const S = () => <AdminPage><PageTitle>物</PageTitle></AdminPage>;\n`,
    "src/app/admin/(protected)/bare/_screen/BareScreen.tsx": `export const S = () => <Section>本文</Section>;\n`,
    "src/app/admin/(protected)/things/_components/Thing.test.tsx": `${TITLE}const x = <PageTitle placement="page">x</PageTitle>;\n`,
    "src/lib/unsavedGuard/guard.ts": `win.addEventListener("beforeunload", onBeforeUnload);\n`,
  });
  try {
    const plan = planAdminHeader(root, { baseFiles: [upstream], checkpoint: "portal" });
    assert.deepEqual(plan.writes.map((w) => w.path), [SCREEN]);
    assert.deepEqual(plan.changes.map((c) => [c.path, c.kind]), [[SCREEN, "title"]]);
    assert.deepEqual(plan.stops.map((s) => [s.path, s.kind, s.due]), [["src/app/admin/(protected)/bare/_screen/BareScreen.tsx", "page-without-admin-page", "now"]]);
    for (const s of plan.stops) {
      assert.ok(Object.hasOwn(STOP_KINDS, s.kind));
      assert.equal(s.target, STOP_KINDS[s.kind]);
      assert.equal(typeof s.line, "number");
    }
    for (const w of plan.writes) writeFileSync(join(root, w.path), w.text);
    const again = planAdminHeader(root, { baseFiles: [upstream], checkpoint: "band" });
    assert.deepEqual(again.writes, []);
    assert.deepEqual(again.stops.map((s) => s.due), ["portal"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("止める種類は閉じた 10 個", () => {
  assert.deepEqual(Object.keys(STOP_KINDS), [
    "portal-title",
    "portal-center",
    "portal-right",
    "page-title-in-body",
    "coupon-tabs-placement",
    "item-navigator",
    "admin-layout-header-prop",
    "slot-id-css",
    "own-unsaved-guard",
    "page-without-admin-page",
  ]);
  assert.ok(Object.isFrozen(STOP_KINDS));
});

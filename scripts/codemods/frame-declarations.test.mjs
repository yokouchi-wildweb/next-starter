// 実行: pnpm test:codemods
// 枠の宣言へ移す道具(./frame-declarations.mjs)を一時フォルダの fork の木で確かめる(指令 11 d1・d2)。
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { matchFrame } from "../../src/app/_layout/frame/resolve.mjs";
import { applyEdits, applyFrameMigration, checkFrames, planFrameMigration } from "./frame-declarations.mjs";

const CONTROLS = "@/components/AppFrames/User/controls";
const page = "export default function Page() { return null; }\n";
const layoutFiles = { "src/app/(user)/layout.tsx": page, "src/app/admin/layout.tsx": page };

function withFork(files, fn, { base = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "frame-codemod-"));
  try {
    for (const [path, text] of Object.entries({ ...layoutFiles, ...files })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const read = (path) => readFileSync(join(root, path), "utf8");
    return fn(root, planFrameMigration(root, { baseFiles: [...Object.keys(layoutFiles), ...base] }), read);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const screen = (body, imports = `import { HideBottomNav, HideFooter, HideHeader } from "${CONTROLS}";`) =>
  `${imports}\nimport { Other } from "x";\n\nexport function XScreen() {\n  return (\n    <>\n${body}\n      <Other />\n    </>\n  );\n}\n`;

test("Hide*: page.tsx → page:、layout.tsx → layout:、<ルート>/_screen・_components の Screen → そのルートの page:、sp / pc / なし / false", () => {
  withFork(
    {
      "src/app/(user)/a/page.tsx": screen("      <HideFooter />"),
      "src/app/(user)/b/layout.tsx": screen("      <HideHeader sp />\n      <HideBottomNav pc={true} sp={false} />"),
      "src/app/(user)/b/page.tsx": page,
      "src/app/(user)/c/[id]/page.tsx": page,
      "src/app/(user)/c/[id]/_screen/CScreen.tsx": screen("      <HideBottomNav />"),
      "src/app/(user)/d/page.tsx": page,
      "src/app/(user)/d/_components/DScreen.tsx": screen("      <HideFooter sp={false} />"),
    },
    (root, plan, read) => {
      assert.deepEqual(plan.stops, []);
      assert.deepEqual(plan.writes.map((w) => w.path), ["src/app/(user)/a/frame.ts", "src/app/(user)/b/frame.ts", "src/app/(user)/c/[id]/frame.ts"], "false だけのタグは宣言を書かずタグだけ消す");
      applyFrameMigration(root, plan);
      assert.match(read("src/app/(user)/a/frame.ts"), /page: \{ hide: \{ footer: \{ sp: true, pc: true \} \} \}/);
      assert.match(read("src/app/(user)/b/frame.ts"), /layout: \{ hide: \{ header: \{ sp: true \}, bottomNav: \{ pc: true \} \} \}/);
      assert.match(read("src/app/(user)/c/[id]/frame.ts"), /page: \{ hide: \{ bottomNav: \{ sp: true, pc: true \} \} \}/);
      assert.match(read("src/app/(user)/a/frame.ts"), /^\/\/ 枠の宣言[\s\S]*import type \{ FrameDeclaration \}[\s\S]*export const frame = \{[\s\S]*\} satisfies FrameDeclaration;\n$/);
      for (const path of ["src/app/(user)/a/page.tsx", "src/app/(user)/b/layout.tsx", "src/app/(user)/c/[id]/_screen/CScreen.tsx", "src/app/(user)/d/_components/DScreen.tsx"]) {
        assert.doesNotMatch(read(path), /Hide|AppFrames\/User\/controls/, path);
        assert.match(read(path), /import \{ Other \} from "x";[\s\S]*<Other \/>/, path);
      }
      const check = checkFrames(root);
      assert.deepEqual(check.problems, [], "書いた frame.ts は生成器の検査を通る");
      assert.deepEqual(matchFrame(["b", "x"], check.tables.user).hide, ["header-sp", "bottom-nav-pc"]);
    },
  );
});

test("fill: <UserPage fill> / <AdminPage fill={true}> → そのルートの page: { fill: true }、属性を消す。管理の枠は AdminFrameDeclaration", () => {
  withFork(
    {
      "src/app/(user)/u/page.tsx": page,
      "src/app/(user)/u/_screen/UScreen.tsx": 'import { UserPage } from "@/app/(user)/_layout/UserPage";\n\nexport function UScreen() {\n  return <UserPage fill className="x">body</UserPage>;\n}\n',
      "src/app/admin/(protected)/g/page.tsx": page,
      "src/app/admin/(protected)/g/_screen/GScreen.tsx": 'import AdminPage from "@/app/admin/_layout/AdminPage";\n\nexport function GScreen() {\n  return <AdminPage fill={true}>body</AdminPage>;\n}\n',
    },
    (root, plan, read) => {
      assert.deepEqual(plan.stops, []);
      applyFrameMigration(root, plan);
      assert.match(read("src/app/(user)/u/frame.ts"), /page: \{ fill: true \}/);
      assert.match(read("src/app/admin/(protected)/g/frame.ts"), /AdminFrameDeclaration[\s\S]*page: \{ fill: true \}/);
      assert.match(read("src/app/(user)/u/_screen/UScreen.tsx"), /<UserPage className="x">body<\/UserPage>/);
      assert.match(read("src/app/admin/(protected)/g/_screen/GScreen.tsx"), /<AdminPage>body<\/AdminPage>/);
      assert.deepEqual(checkFrames(root).problems, []);
    },
  );
});

test("既にある frame.ts に部位と端末ごとに足す。読めない frame.ts は止めてそのファイルを書き換えない", () => {
  withFork(
    {
      "src/app/(user)/a/page.tsx": screen("      <HideFooter sp />"),
      "src/app/(user)/a/frame.ts": 'export const frame = { page: { hide: { header: { pc: true } } } };\n',
      "src/app/(user)/b/page.tsx": screen("      <HideFooter />"),
      "src/app/(user)/b/frame.ts": "export const frame = { hide: { footer: { sp: true } } };\n",
    },
    (root, plan, read) => {
      assert.deepEqual(plan.stops.map((s) => s.path), ["src/app/(user)/b/frame.ts"]);
      assert.match(plan.stops[0].reason, /今の frame\.ts を読めない/);
      applyFrameMigration(root, plan);
      assert.match(read("src/app/(user)/a/frame.ts"), /page: \{ hide: \{ header: \{ pc: true \}, footer: \{ sp: true \} \} \}/);
      assert.equal(read("src/app/(user)/b/frame.ts"), "export const frame = { hide: { footer: { sp: true } } };\n");
      assert.match(read("src/app/(user)/b/page.tsx"), /<HideFooter \/>/, "止めた frame.ts へのタグは残す");
    },
  );
});

test("止める: 子を持つ・条件つき・式の props・Screen でない部品・ルートの外・管理の枠の Hide*、immersive、fill={式}、消えた API の読み手", () => {
  withFork(
    {
      "src/app/(user)/a/page.tsx": screen("      <HideFooter>x</HideFooter>\n      {open && <HideHeader />}\n      <HideBottomNav sp={isSp} />"),
      "src/app/(user)/a/_components/Part.tsx": screen("      <HideFooter />"),
      "src/features/game/Play.tsx": screen("      <HideHeader />"),
      "src/app/admin/(protected)/x/page.tsx": screen("      <HideFooter />"),
      "src/app/(user)/i/page.tsx": page,
      "src/app/(user)/i/_screen/IScreen.tsx": 'import { UserPage } from "@/app/(user)/_layout/UserPage";\nexport function IScreen() {\n  return <UserPage immersive>x</UserPage>;\n}\n',
      "src/app/(user)/f/page.tsx": page,
      "src/app/(user)/f/_screen/FScreen.tsx": 'import { UserPage } from "@/app/(user)/_layout/UserPage";\nexport function FScreen() {\n  return <UserPage fill={wide}>x</UserPage>;\n}\n',
      "src/app/(user)/_layout/BottomNav/Mine.tsx": 'import { useBottomNavItems } from "./useBottomNavItems";\nexport function Mine() {\n  const { enabled } = useBottomNavItems();\n  return enabled;\n}\n',
      "src/app/(user)/_components/Header/index.tsx": 'import { useHeaderData } from "@/app/(user)/_layout/hooks";\nexport function H() {\n  const { navEnabled } = useHeaderData();\n  return navEnabled;\n}\n',
      "src/app/(user)/_layout/hooks/useMine.ts": 'import { BOTTOM_NAV_ENABLED } from "@/config/ui/user-bottom-menu.config";\nexport const useMine = () => BOTTOM_NAV_ENABLED;\n',
    },
    (_root, plan) => {
      const reasons = plan.stops.map((s) => `${s.path.replace(/:\d+$/, "")} ${s.reason}`);
      const has = (path, re) => assert.ok(reasons.some((r) => r.startsWith(path) && re.test(r)), `${path} ${re}\n${reasons.join("\n")}`);
      has("src/app/(user)/a/page.tsx", /子を持つ/);
      has("src/app/(user)/a/page.tsx", /条件の中/);
      has("src/app/(user)/a/page.tsx", /props が sp \/ pc の真偽でない/);
      has("src/app/(user)/a/_components/Part.tsx", /Screen\(<名前>Screen\.tsx\)でない部品/);
      has("src/features/game/Play.tsx", /ルートの page \/ layout \/ Screen/);
      has("src/app/admin/(protected)/x/page.tsx", /利用者の枠の部品/);
      has("src/app/(user)/i/_screen/IScreen.tsx", /immersive> は意味が 1 つに決まらない/);
      has("src/app/(user)/f/_screen/FScreen.tsx", /fill=\{…\}> が式/);
      has("src/app/(user)/_layout/BottomNav/Mine.tsx", /useBottomNavItems\(\)\.enabled/);
      has("src/app/(user)/_components/Header/index.tsx", /useHeaderData\(\)\.enabled \/ navEnabled/);
      has("src/app/(user)/_layout/hooks/useMine.ts", /消えた設定 BOTTOM_NAV_ENABLED/);
      assert.equal(plan.stops.length, 11);
      assert.deepEqual(plan.changes, []);
      assert.deepEqual(plan.writes, []);
    },
  );
});

test("枠の設定の 4 つ: 上流の旧い既定と違う値だけ (user)/frame.ts の layout: へ(設定の行は書き換えない)", () => {
  const bottom = (enabled, sp, pc) => `export const BOTTOM_NAV_ENABLED = ${enabled};\nexport const BOTTOM_NAV_HEIGHT = 64;\nexport const BOTTOM_NAV_VISIBILITY = { sp: ${sp}, pc: ${pc} } as const;\n`;
  const header = (enabled, sp, pc) => `export const HEADER_ENABLED = ${enabled};\nexport const HEADER_NAV_ENABLED = { sp: ${sp}, pc: ${pc} };\n`;
  const files = (b, h) => ({ "src/config/ui/user-bottom-menu.config.ts": b, "src/config/ui/user-header.config.ts": h });
  const base = ["src/config/ui/user-bottom-menu.config.ts", "src/config/ui/user-header.config.ts"];
  withFork(files(bottom(true, true, false), header(true, true, true)), (_root, plan) => assert.deepEqual(plan.writes, [], "既定のままなら何もしない"), { base });
  withFork(files(bottom(true, false, true), header(false, false, true)), (root, plan, read) => {
    assert.equal(plan.changes.length, 1);
    assert.deepEqual(plan.changes[0].values, ['BOTTOM_NAV_VISIBILITY = {"sp":false,"pc":true}', "HEADER_ENABLED = false", 'HEADER_NAV_ENABLED = {"sp":false,"pc":true}']);
    applyFrameMigration(root, plan);
    assert.match(read("src/app/(user)/frame.ts"), /layout: \{ hide: \{ header: \{ sp: true, pc: true \}, headerNav: \{ sp: true \}, bottomNav: \{ sp: true, pc: false \} \} \}/);
    assert.match(read("src/config/ui/user-header.config.ts"), /HEADER_ENABLED = false/, "設定の行は残す");
    assert.deepEqual(checkFrames(root).problems, []);
  }, { base });
  withFork(files(bottom(false, false, true), header(true, true, true)), (_root, plan) => {
    assert.deepEqual(plan.changes[0].values, ["BOTTOM_NAV_ENABLED = false"], "ENABLED false は VISIBILITY より先");
  }, { base });
});

test("上流のファイル(基準にある物)は触らない", () => {
  withFork(
    { "src/app/(user)/maintenance/page.tsx": page, "src/app/(user)/maintenance/_screen/MaintenanceScreen.tsx": screen("      <HideFooter />") },
    (_root, plan) => {
      assert.deepEqual(plan.changes, []);
      assert.deepEqual(plan.stops, []);
    },
    { base: ["src/app/(user)/maintenance/page.tsx", "src/app/(user)/maintenance/_screen/MaintenanceScreen.tsx"] },
  );
});

test("applyEdits: 使われなくなった Hide* の import だけ消す(残る名前は import に残す)", () => {
  const text = `import { HideFooter, HideHeader } from "${CONTROLS}";\nimport { A } from "a";\nconst x = <><HideFooter /><HideHeader>y</HideHeader></>;\n`;
  const start = text.indexOf("<HideFooter />");
  assert.equal(applyEdits(text, [[start, start + "<HideFooter />".length]]), `import { HideHeader } from "${CONTROLS}";\nimport { A } from "a";\nconst x = <><HideHeader>y</HideHeader></>;\n`);
});

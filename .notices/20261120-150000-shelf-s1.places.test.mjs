// .notices/20261120-150000-shelf-s1.places.test.mjs
// codemod shelf-s1 places: 入口の分割・相対の指定・動いた場所・FullScreen の default→名前付き・止める所・手で直す所・何度走らせても同じ
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { apply, emitSpecifier, mapModule, plan, resolveSpecifier, rewriteSource } from "./20261120-150000-shelf-s1.places.mjs";

const repo = (files) => {
  const root = mkdtempSync(path.join(tmpdir(), "shelf-s1-places-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
};

test("指定の解き方: @/・相対・src/ をモジュールの道と末尾に分ける", () => {
  assert.deepEqual(resolveSpecifier("src/app/x.tsx", "@/components/Layout"), { mod: "src/components/Layout", suffix: "" });
  assert.deepEqual(resolveSpecifier("src/components/Form/x.tsx", "../Layout/index"), { mod: "src/components/Layout", suffix: "/index" });
  assert.deepEqual(resolveSpecifier("scripts/a/b.mjs", "./c.ts"), { mod: "scripts/a/c", suffix: ".ts" });
  assert.equal(resolveSpecifier("src/app/x.tsx", "react"), null);
  assert.equal(mapModule("src/components/Layout/spacingScale").to, "src/lib/spacing");
  assert.equal(mapModule("src/components/AppFrames/Admin/Elements/ItemNavigator/types").to, "src/components/Admin/ItemNavigator/types");
  assert.equal(mapModule("src/components/Three/Summoning").kind, "deleted");
  assert.equal(mapModule("src/components/Layout/Block"), null);
  assert.equal(emitSpecifier("../Layout/spacing", "src/components/Form/AppForm.tsx", "src/lib/spacing"), "@/lib/spacing");
  assert.equal(emitSpecifier("../Layout", "src/components/Form/x.tsx", "src/components/Layout/Stack"), "../Layout/Stack");
});

test("入口: 混ざった名前を定義元ごとの 1 文に分け、type・inline type・as を保つ", () => {
  const src = [
    'import { Block, Flex as F, type SpacingValue } from "@/components/Layout";',
    'import type { MainProps, ParaProps } from "@/components/TextBlocks";',
    "export { SolidBadge, type BadgeSize } from '@/components/Badge';",
    "import {",
    "  Link, // ナビ",
    "  StateTabs,",
    '} from "@/components/Navigation"',
  ].join("\n");
  const { text, hits, stops } = rewriteSource("src/app/x.tsx", src);
  assert.deepEqual(stops, []);
  assert.equal(hits.length, 4);
  assert.equal(
    text,
    [
      'import { Block } from "@/components/Layout/Block";',
      'import { Flex as F } from "@/components/Layout/Flex";',
      'import { type SpacingValue } from "@/lib/spacing";',
      'import type { MainProps } from "@/components/Layout/Main";',
      'import type { ParaProps } from "@/components/TextBlocks/Para";',
      "export { SolidBadge } from '@/components/Badge/SolidBadge';",
      "export { type BadgeSize } from '@/components/Badge/badge-variants';",
      'import { Link } from "@/components/Navigation/Link"',
      'import { StateTabs } from "@/components/Navigation/StateTabs"',
    ].join("\n"),
  );
});

test("入口: default の部品(Pagination)は default の import に、re-export は default as に", () => {
  const src = [
    'import { Pagination, type PaginationProps, Link } from "@/components/Navigation";',
    'import { Pagination as Pager } from "@/components/Navigation";',
    'export { Pagination } from "@/components/Navigation";',
  ].join("\n");
  const { text } = rewriteSource("src/app/x.tsx", src);
  assert.equal(
    text,
    [
      'import Pagination, { type PaginationProps } from "@/components/Navigation/Pagination";',
      'import { Link } from "@/components/Navigation/Link";',
      'import Pager from "@/components/Navigation/Pagination";',
      'export { default as Pagination } from "@/components/Navigation/Pagination";',
    ].join("\n"),
  );
});

test("相対の指定: 入口の分割も動いた場所も相対のまま、閉じた lib は @/lib/spacing", () => {
  const src = [
    'import { Stack } from "../Layout";',
    'import type { SpacingValue } from "../Layout/spacing";',
    'import { appearance } from "../Layout/commonVariants";',
    'import { BodyPortal } from "../Functional/BodyPortal";',
  ].join("\n");
  const { text } = rewriteSource("src/components/Form/x.tsx", src);
  assert.equal(
    text,
    [
      'import { Stack } from "../Layout/Stack";',
      'import type { SpacingValue } from "@/lib/spacing";',
      'import { appearance } from "../Layout/appearance";',
      'import { BodyPortal } from "../Overlays/BodyPortal";',
    ].join("\n"),
  );
});

test("動いた場所: mock.module・import() の文字列も書き換え、Elements はその下の道を保つ", () => {
  const src = [
    'mock.module("@/hooks/useHeaderHeight", { namedExports: {} });',
    'const k = await import("@/components/AppFrames/Kiosk");',
    'import { ListTop } from "@/components/AppFrames/Admin/Elements/ListTop";',
    'import { ItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";',
  ].join("\n");
  const { text } = rewriteSource("src/app/x.test.tsx", src);
  assert.ok(text.includes('mock.module("@/app/_layout/useHeaderHeight"'));
  assert.ok(text.includes('import("@/components/Layout/KioskFrame")'));
  assert.ok(text.includes('"@/components/Admin/ListTop"'));
  assert.ok(text.includes('"@/components/Admin/ItemNavigator"'));
});

test("FullScreen: default の import・re-export を名前付きに", () => {
  const src = [
    'import FullScreen from "@/components/Layout/FullScreen";',
    'import Full, { type FullScreenLayer } from "./FullScreen";',
    'export { default as FullScreen } from "./FullScreen";',
    'import { type FullScreenLayer as L } from "./FullScreen";',
  ].join("\n");
  const { text, hands } = rewriteSource("src/components/Layout/Main.tsx", src);
  assert.equal(
    text,
    [
      'import { FullScreen } from "@/components/Layout/FullScreen";',
      'import { FullScreen as Full, type FullScreenLayer } from "./FullScreen";',
      'export { FullScreen } from "./FullScreen";',
      'import { type FullScreenLayer as L } from "./FullScreen";',
    ].join("\n"),
  );
  assert.deepEqual(hands, []);
});

test("止める: 消したもの・表にない名前は書き換えず STOP、入口の mock.module や文字列は hand", () => {
  const src = [
    'import { Hidden, Block } from "@/components/Layout";',
    'import { HeadPortal } from "@/components/Functional/HeadPortal";',
    'import Scene from "@/components/Three/StarTunnelCanvas";',
    'import { Nope } from "@/components/Icons";',
    'mock.module("@/components/Navigation", { namedExports: {} });',
    'const paths = ["@/components/Icons"];',
  ].join("\n");
  const { text, stops, hands } = rewriteSource("src/app/x.tsx", src);
  assert.equal(text, src);
  assert.equal(stops.length, 4);
  const sorted = [...stops].sort();
  assert.match(sorted[0], /^1: .*Hidden は消した/);
  assert.match(sorted[1], /^2: .*HeadPortal は消した/);
  assert.match(sorted[2], /^3: .*Three\/StarTunnelCanvas は消した/);
  assert.match(sorted[3], /^4: .*Nope の定義元が見つからない/);
  assert.equal(hands.length, 2);
  assert.match(hands[0], /^5: @\/components\/Navigation は消した入口/);
});

test("表にない名前は fork の木の部品から探す(fork が足したアイコン)", () => {
  const lookup = (entry, name) => (entry === "src/components/Icons" && name === "BrandIcon" ? "src/components/Icons/definitions" : null);
  const { text } = rewriteSource("src/app/x.tsx", 'import { BrandIcon, FileIcon, type CustomIcon } from "@/components/Icons";', { lookup });
  assert.equal(
    text,
    ['import { BrandIcon, FileIcon } from "@/components/Icons/definitions";', 'import { type CustomIcon } from "@/components/Icons/types";'].join("\n"),
  );
});

test("plan と apply: 書き換え・Elements の fork のファイルの移動(相対を引き直す)・文書は一覧だけ、2 回目は変えるものなし", () => {
  const root = repo({
    "src/app/page.tsx": 'import { Block, Section } from "@/components/Layout";\nimport { BrandIcon } from "@/components/Icons";\n',
    "src/components/Icons/definitions.ts": 'export const FileIcon = 1;\nexport const BrandIcon = 2;\n',
    "src/components/AppFrames/Admin/Elements/ForkBox.tsx": 'import { Block } from "../../../Layout/Block";\nimport { ListTop } from "./ListTop";\n',
    "src/components/Admin/ListTop.tsx": "export const ListTop = 1;\n",
    "src/components/Layout/Block.tsx": "export const Block = 1;\n",
    "src/features/shop/README.md": "@/components/Layout から読む\n`@/components/Layout/Block` は触らない\n",
    "scripts/x/y.mjs": 'import { SPACING_SCALE } from "@/components/Layout/spacingScale";\nconst out = "src/components/Layout/spacingClasses.generated.ts";\n',
  });
  const first = plan(root);
  assert.deepEqual(first.stops, []);
  assert.deepEqual(first.rewrites.map((r) => r.file).sort(), ["scripts/x/y.mjs", "src/app/page.tsx", "src/components/AppFrames/Admin/Elements/ForkBox.tsx"]);
  assert.deepEqual(first.moves, [{ from: "src/components/AppFrames/Admin/Elements/ForkBox.tsx", to: "src/components/Admin/ForkBox.tsx" }]);
  assert.deepEqual(
    first.hands.map((h) => `${h.file}:${h.line}`),
    ["scripts/x/y.mjs:2", "src/features/shop/README.md:1"],
  );
  apply(root, first);
  const page = readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  assert.ok(page.includes('import { Block } from "@/components/Layout/Block";'));
  assert.ok(page.includes('import { Section } from "@/components/Layout/Section";'));
  assert.ok(page.includes('import { BrandIcon } from "@/components/Icons/definitions";'));
  const box = readFileSync(path.join(root, "src/components/Admin/ForkBox.tsx"), "utf8");
  assert.ok(box.includes('"../Layout/Block"'));
  assert.ok(box.includes('"./ListTop"'));
  assert.ok(!existsSync(path.join(root, "src/components/AppFrames/Admin/Elements/ForkBox.tsx")));
  assert.ok(readFileSync(path.join(root, "scripts/x/y.mjs"), "utf8").includes('from "@/lib/spacing"'));
  const second = plan(root);
  assert.equal(second.rewrites.length + second.moves.length + second.stops.length, 0);
});

test("止める: 行き先に同じ名がある Elements のファイル・Kiosk に残った fork のファイル", () => {
  const root = repo({
    "src/components/AppFrames/Admin/Elements/ListTop.tsx": "export const ListTop = 'fork';\n",
    "src/components/Admin/ListTop.tsx": "export const ListTop = 'upstream';\n",
    "src/components/AppFrames/Kiosk/ForkKiosk.tsx": "export const K = 1;\n",
  });
  const result = plan(root);
  assert.deepEqual(result.moves, []);
  assert.deepEqual(result.stops.map((s) => s.file).sort(), ["src/components/AppFrames/Admin/Elements/ListTop.tsx", "src/components/AppFrames/Kiosk/ForkKiosk.tsx"]);
});

// .notices/20261125-174936-cc-screen-maker.screen-maker.test.mjs — 区切り cc-screen-maker の移し替えの道具の試し
// 実行: pnpm test .notices/20261125-174936-cc-screen-maker.screen-maker.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { plan, transformPage, transformScreen } from "./20261125-174936-cc-screen-maker.screen-maker.mjs";

const bound = `import type { ScreenProps } from "@/lib/screens";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadXScreen } from "./loader";

export const metadata = {
  title: "一覧",
};

export async function XScreen(props: ScreenProps) {
  const { items } = await loadXScreen(props);

  return (
    <AdminPage title="x">
      <List items={items} />
    </AdminPage>
  );
}
`;

test("束ねる load・静的な metadata: 作り手の形へ、使わなくなった型の import を外し作り手を足す", () => {
  const r = transformScreen(bound, "XScreen");
  assert.equal(r.status, "changed");
  assert.equal(
    r.text,
    `import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadXScreen } from "./loader";

export const { Screen: XScreen, generateMetadata } = createScreen({
  load: loadXScreen,
  render: ({ items }) => (
    <AdminPage title="x">
      <List items={items} />
    </AdminPage>
  ),
  metadata: {
    title: "一覧",
  },
});
`,
  );
  assert.equal(transformScreen(r.text, "XScreen").status, "already", "2 回目は何もしない");
});

test("束ねない load と load の後の文: render は () => { 文; return … }、await があれば async", () => {
  const src = `import { loadXScreen } from "./loader";

export async function XScreen(props) {
  await loadXScreen(props);
  const doc = await readDoc();

  return <p>{doc}</p>;
}
`;
  const r = transformScreen(src, "XScreen");
  assert.equal(r.status, "changed");
  assert.match(r.text, /render: async \(\) => \{\n {4}const doc = await readDoc\(\);\n\n {4}return <p>\{doc\}<\/p>;\n {2}\},/);
});

test("load の後で props を読む: render: (data, props)", () => {
  const src = `import { loadXScreen } from "./loader";\n\nexport async function XScreen(props) {\n  await loadXScreen(props);\n  return <W p={props} />;\n}\n`;
  const r = transformScreen(src, "XScreen");
  assert.match(r.text, /render: \(_data, props\) => <W p=\{props\} \/>,/);
});

test("止まる形: load の前の文・load が最初でない・2 回・型の注釈・自前の generateMetadata・関数が無い", () => {
  const stop = (src) => transformScreen(src, "XScreen");
  const before = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  const a = 1;\n  await loadXScreen(props);\n  return null;\n}`;
  assert.match(stop(before).reason, /load の前に文がある/);
  const inIf = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  if (props.a) await loadXScreen(props);\n  return null;\n}`;
  assert.match(stop(inIf).reason, /最初の文が await load/);
  const twice = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  await loadXScreen(props);\n  await loadXScreen(props);\n  return null;\n}`;
  assert.match(stop(twice).reason, /2 回/);
  const typed = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  const d: D = await loadXScreen(props);\n  return null;\n}`;
  assert.match(stop(typed).reason, /型の注釈/);
  const ownTitle = `${before.replace("  const a = 1;\n", "")}\nexport async function generateMetadata() { return {}; }`;
  assert.match(stop(ownTitle).reason, /自前の generateMetadata/);
  assert.match(stop(`export function Other() { return null; }`).reason, /export の関数 XScreen が無い/);
});

test("page.tsx: metadata の再 export を generateMetadata に、無ければ足す、自前の題名は止める", () => {
  assert.equal(transformPage(`export { XScreen as default, metadata } from "./_screen/XScreen";\n`).text, `export { XScreen as default, generateMetadata } from "./_screen/XScreen";\n`);
  assert.equal(transformPage(`export { XScreen as default } from "./_components/XScreen";\n`).text, `export { XScreen as default, generateMetadata } from "./_components/XScreen";\n`);
  assert.equal(transformPage(`export { XScreen as default, generateMetadata } from "./_screen/XScreen";\n`).status, "already");
  assert.equal(transformPage(`export const metadata = { title: "x" };\nexport { XScreen as default } from "./_screen/XScreen";\n`).status, "stop");
});

test("plan: page.tsx から Screen を辿り、止まった Screen の page.tsx は書き換えない", () => {
  const root = mkdtempSync(path.join(tmpdir(), "screen-maker-"));
  const write = (rel, text) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  write("src/app/a/page.tsx", `export { XScreen as default, metadata } from "./_screen/XScreen";\n`);
  write("src/app/a/_screen/XScreen.tsx", bound);
  write("src/app/b/page.tsx", `export { YScreen as default } from "./_components/YScreen";\n`);
  write("src/app/b/_components/YScreen.tsx", `import { loadYScreen } from "../_screen/loader";\nexport async function YScreen(props) {\n  if (props) await loadYScreen(props);\n  return null;\n}\n`);
  const { writes, stops } = plan(root);
  assert.deepEqual(writes.map((w) => w.file).sort(), ["src/app/a/_screen/XScreen.tsx", "src/app/a/page.tsx"]);
  assert.deepEqual(stops.map((s) => s.file), ["src/app/b/_components/YScreen.tsx"]);
  assert.equal(readFileSync(path.join(root, "src/app/a/page.tsx"), "utf8").includes("metadata }"), true, "dry-run は書かない");
});

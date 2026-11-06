// 利用者の枠の部位の印(data-slot)と表の結線の検査。実行: pnpm test src/app/(user)/_layout/UserFrame.test.tsx
//
// 1. README の「data-slot の一覧」= 利用者の枠の部品と Main(src/components/Layout/Main.tsx)の要素の data-slot(片方にしか無い名前は失敗)
//    = 部位の一覧(src/app/_layout/frame/parts.mjs)の利用者の枠と Main。隠せる部位 ⊂ 一覧。shadcn の部品の data-slot と衝突しない。data-frame-part は残らない
// 2. frame.css の利用者の規則が狙う id が既定の枠部品に実在し、外枠に data-frame-root がある(規則と部位の一覧の一致は parts.test.mjs)
// 3. 根の結線: UserLayout が共通の読み手 useFrameAttributes に自分の表を渡す。上流の宣言の解決結果
// (読み手そのものの検査は src/app/_layout/frame/useFrameAttributes.test.tsx)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repo = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");
const LAYOUT = "src/app/(user)/_layout";
const MAIN = "src/components/Layout/Main.tsx";

let parts: typeof import("@/app/_layout/frame");
let frameTable: typeof import("./extensions/frameTable").frameTable;
before(async () => {
  parts = await import("@/app/_layout/frame");
  ({ frameTable } = await import("./extensions/frameTable"));
});

/** dir の下の .tsx(テストを除く) */
const sourcesUnder = (dir: string): string[] =>
  readdirSync(join(repo, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(repo, path)).isDirectory()) return sourcesUnder(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
  });
const slotsIn = (text: string) => [...text.matchAll(/data-slot="([a-z-]+)"/g)].map((m) => m[1]);
/** README の「data-slot の一覧」の節の `- \`<名前>\`` の行 */
const readmeSlots = () => {
  const readme = read(`${LAYOUT}/README.md`);
  const at = readme.indexOf("## data-slot の一覧");
  assert.ok(at >= 0, "README に「data-slot の一覧」の節が無い");
  const section = readme.slice(at).split(/\n## /)[0];
  return [...section.matchAll(/^- `([a-z-]+)`/gm)].map((m) => m[1]);
};

test("README の data-slot の一覧 = 枠の部品と Main の要素の data-slot = 部位の一覧の利用者の枠と Main", () => {
  const listed = readmeSlots();
  assert.equal(new Set(listed).size, listed.length, "一覧に重なり");
  const used = new Set([...sourcesUnder(LAYOUT), MAIN].flatMap((file) => slotsIn(read(file))));
  assert.deepEqual([...used].sort(), [...listed].sort(), "README の一覧と要素の data-slot が合わない");
  const expected = parts.FRAME_SLOTS.filter((s) => s.area === "user" || s.area === "main").map((s) => s.name);
  assert.deepEqual([...listed].sort(), [...expected].sort(), "部位の一覧(parts.mjs)と合わない");
  for (const { slot } of parts.hideableParts("user")) assert.ok(listed.includes(slot), `隠せる部位 ${slot} が一覧に無い`);
});

test("shadcn の部品の data-slot と名前が衝突せず、data-frame-part は残っていない", () => {
  const shadcn = new Set(sourcesUnder("src/components/_shadcn").flatMap((file) => slotsIn(read(file))));
  assert.ok(shadcn.has("button"), "shadcn の data-slot が読めていない");
  for (const name of readmeSlots()) assert.equal(shadcn.has(name), false, `${name} は shadcn の data-slot と同じ`);
  for (const file of [...sourcesUnder(LAYOUT), MAIN]) assert.equal(read(file).includes("data-frame-part"), false, `${file} に data-frame-part`);
});

test("frame.css の利用者の規則が狙う id が既定の枠部品に実在し、外枠に data-frame-root がある", () => {
  const all = sourcesUnder(LAYOUT).map(read).join("\n") + read("src/components/AppFrames/constants.ts");
  const css = read("src/styles/core/frame.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const userRules = css.split("\n").filter((line) => /data-frame-hide~="(?!admin-)/.test(line)).join("\n");
  for (const id of new Set([...userRules.matchAll(/#([a-z-]+)/g)].map((m) => m[1]))) {
    assert.ok(all.includes(`"${id}"`), `#${id} の部品が無い`);
  }
  assert.ok(read(`${LAYOUT}/UserLayout.tsx`).includes('data-frame-root=""'));
});

test("根の結線: UserLayout は共通の読み手に (user) の表を渡す", () => {
  const src = read(`${LAYOUT}/UserLayout.tsx`);
  assert.ok(src.includes('import { useFrameAttributes } from "@/app/_layout/frame/useFrameAttributes";'));
  assert.ok(src.includes('import { frameTable } from "./extensions/frameTable";'));
  assert.ok(src.includes("useFrameAttributes(frameTable)"));
});

test("上流の宣言: 準備中は header-nav・footer・bottom-nav、signup の下はボトムナビと SP のフッターを隠し、既定はボトムナビを PC で隠す、トップページ / だけ fill", () => {
  assert.deepEqual(parts.matchFrame([], frameTable), { hide: ["bottom-nav-pc"], fill: true });
  assert.deepEqual(parts.matchFrame(["(public)", "about"], frameTable), { hide: ["bottom-nav-pc"], fill: false }, "fill は / だけ(子のルートに継がない)");
  assert.deepEqual(parts.matchFrame(["maintenance"], frameTable).hide, ["header-nav-sp", "header-nav-pc", "footer-sp", "footer-pc", "bottom-nav-sp", "bottom-nav-pc"]);
  assert.deepEqual(parts.matchFrame(["(auth)", "signup", "verify"], frameTable).hide, ["footer-sp", "bottom-nav-sp", "bottom-nav-pc"]);
  assert.deepEqual(parts.matchFrame(["(auth)", "demo-login"], frameTable).hide, ["footer-sp", "footer-pc", "bottom-nav-sp", "bottom-nav-pc"]);
});

test("SP の開閉ボタンは display: contents の包みが部位の印 header-nav を持ち、ボタン(shadcn)の data-slot=\"button\" は上書きしない", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { SpNavSwitch } = await import("./Header/Sp/SpNavSwitch");
  const html = renderToStaticMarkup(createElement(SpNavSwitch, { isMenuOpen: false, onToggle: () => {} }));
  const wrapper = html.match(/^<[a-z]+[^>]*>/)?.[0] ?? "";
  assert.ok(wrapper.includes('data-slot="header-nav"'), html);
  assert.match(wrapper, /class="[^"]*\bcontents\b/);
  const button = html.match(/<button[^>]*id="header-sp-menu-toggle"[^>]*>/)?.[0] ?? "";
  assert.ok(button.includes('data-slot="button"'), "ボタンの data-slot が button でない");
});

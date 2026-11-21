// 利用者の枠の部位の印(data-slot)と表の結線の検査。実行: pnpm test src/app/(user)/_layout/UserFrame.test.tsx
//
// 1. README の「data-slot の一覧」= 利用者の枠の部品と Main(src/components/Layout/Main.tsx)の要素の data-slot(片方にしか無い名前は失敗)
//    見出しの印は source が枠の中のもの(user-page-title)も入る。見出しの印と描画の照合は src/components/TextBlocks/headingSlots.test.tsx
//    = 部位の一覧(src/app/_layout/frame/parts.mjs)の利用者の枠と Main。隠せる部位 ⊂ 一覧。Primitives の部品の data-slot と衝突しない。data-frame-part は残らない
// 2. frame.css の利用者の規則が狙う id が既定の枠部品に実在し、外枠に data-frame-root がある(規則と部位の一覧の一致は parts.test.mjs)
// 3. 根の結線: UserLayout が共通の読み手 useFrameAttributes に自分の表を渡す。上流の宣言(frame.ts だけ、全 Tier)の解決結果と、生成の表との一致(Tier1 だけ: fork の表は frame.override.ts を含む)
// (読み手そのものの検査は src/app/_layout/frame/useFrameAttributes.test.tsx)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repo = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");
const LAYOUT = "src/app/(user)/_layout";
const MAIN = "src/components/Layout/Main.tsx";

let parts: typeof import("@/app/_layout/frame");
let primitiveSlots: typeof import("@/components/Primitives/slots.mjs");
let frameTable: typeof import("./extensions/frameTable").frameTable;
before(async () => {
  parts = await import("@/app/_layout/frame");
  primitiveSlots = await import("@/components/Primitives/slots.mjs");
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
  const listed = primitiveSlots.readmeSlotsOf(read(`${LAYOUT}/README.md`));
  assert.ok(listed, "README に「data-slot の一覧」の節が無い");
  return listed;
};

test("README の data-slot の一覧 = 枠の部品と Main の要素の data-slot = 部位の一覧の利用者の枠と Main", () => {
  const listed = readmeSlots();
  assert.equal(new Set(listed).size, listed.length, "一覧に重なり");
  const used = new Set([...sourcesUnder(LAYOUT), MAIN].flatMap((file) => slotsIn(read(file))));
  assert.deepEqual([...used].sort(), [...listed].sort(), "README の一覧と要素の data-slot が合わない");
  // 見出しの印は source(印を描く部品のファイル)が枠の中にあるものだけ(user-page-title)
  const expected = parts.FRAME_SLOTS.filter(
    (s) => s.area === "user" || s.area === "main" || (s.area === "heading" && s.source?.startsWith(`${LAYOUT}/`)),
  ).map((s) => s.name);
  assert.deepEqual([...listed].sort(), [...expected].sort(), "部位の一覧(parts.mjs)と合わない");
  for (const { slot } of parts.hideableParts("user")) assert.ok(listed.includes(slot), `隠せる部位 ${slot} が一覧に無い`);
});

test("Primitives の部品の data-slot と名前が衝突せず、data-frame-part は残っていない", () => {
  // Primitives の部品の印 = Primitives の約束の一覧(README、src/components/Primitives/slots.mjs)
  const primitives = new Set(primitiveSlots.allPrimitiveSlots(repo));
  assert.ok(primitives.has("button"), "Primitives の data-slot が読めていない");
  for (const name of readmeSlots()) assert.equal(primitives.has(name), false, `${name} は Primitives の data-slot と同じ`);
  for (const file of [...sourcesUnder(LAYOUT), MAIN]) assert.equal(read(file).includes("data-frame-part"), false, `${file} に data-frame-part`);
});

test("frame.css の利用者の規則は id を狙わず、外枠に data-frame-root がある", () => {
  const css = read("src/styles/core/frame.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const userRules = css.split("\n").filter((line) => /data-frame-hide~="(?!admin-)/.test(line)).join("\n");
  assert.equal(/#[a-z]/.test(userRules), false, "利用者の規則が id を狙っている(狙う先は data-slot だけ)");
  assert.ok(read(`${LAYOUT}/UserLayout.tsx`).includes('data-frame-root=""'));
});

test("根の結線: UserLayout は共通の読み手に (user) の表を渡す", () => {
  const src = read(`${LAYOUT}/UserLayout.tsx`);
  assert.ok(src.includes('import { useFrameAttributes } from "@/app/_layout/frame/useFrameAttributes";'));
  assert.ok(src.includes('import { frameTable } from "./extensions/frameTable";'));
  assert.ok(src.includes("useFrameAttributes(frameTable)"));
});

/**
 * 上流の宣言だけ(各ルートの frame.ts)で segments のページの値を解く。下のリポの frame.override.ts は読まない
 * (fork・中間 Tier は上流のルートを frame.override.ts で変える。生成の表 frameTable はそれを含むので、全 Tier で見るのはこちら)。
 * 重ね方は生成器と同じ: 浅い段から layout、葉の段で最後に page(src/app/_layout/frame/README.md)
 */
const upstreamFrame = async (segments: readonly string[]) => {
  const { emptyFrame, frameRowValue, overlayFrame } = await import("@/app/_layout/frame/resolve.mjs");
  const declarationOf = async (segs: readonly string[]) => {
    const path = join(repo, "src/app/(user)", ...segs, "frame.ts");
    if (!existsSync(path)) return undefined;
    return ((await import(pathToFileURL(path).href)) as { frame?: { layout?: object; page?: object } }).frame;
  };
  let value = emptyFrame();
  for (let i = 0; i <= segments.length; i += 1) value = overlayFrame(value, (await declarationOf(segments.slice(0, i)))?.layout, "user");
  value = overlayFrame(value, (await declarationOf(segments))?.page, "user");
  return frameRowValue(value, "user");
};

test("上流の宣言(frame.ts だけ): 準備中は header-nav・footer・bottom-nav、signup の下はボトムナビと SP のフッターを隠し、既定はボトムナビを PC で隠す、トップページ / だけ fill(全 Tier。fork の frame.override.ts は読まない)", async () => {
  const cases: [readonly string[], { hide: string[]; fill: boolean }][] = [
    [[], { hide: ["bottom-nav-pc"], fill: true }],
    [["(public)", "about"], { hide: ["bottom-nav-pc"], fill: false }],
    [["maintenance"], { hide: ["header-nav-sp", "header-nav-pc", "footer-sp", "footer-pc", "bottom-nav-sp", "bottom-nav-pc"], fill: false }],
    [["(auth)", "signup", "verify"], { hide: ["footer-sp", "bottom-nav-sp", "bottom-nav-pc"], fill: false }],
    [["(auth)", "demo-login"], { hide: ["footer-sp", "footer-pc", "bottom-nav-sp", "bottom-nav-pc"], fill: false }],
  ];
  for (const [segments, expected] of cases) assert.deepEqual(await upstreamFrame(segments), expected, `/${segments.join("/")}`);
  // fill は / だけ(子のルートに継がない) = 上の (public)/about の fill: false
});

test("生成の表は上流の宣言と同じに解く(Tier1 だけ: fork の表は frame.override.ts の宣言を含む)", async (t) => {
  const { readForkIdentity } = await import("@/lib/forkOwnership/node.mjs");
  if (!readForkIdentity(repo).isTier1) {
    t.skip("fork の生成の表は frame.override.ts を含むので上流の宣言と違ってよい");
    return;
  }
  for (const segments of [[], ["(public)", "about"], ["maintenance"], ["(auth)", "signup", "verify"], ["(auth)", "demo-login"]]) {
    assert.deepEqual(parts.matchFrame(segments, frameTable), await upstreamFrame(segments), `/${segments.join("/")}`);
  }
});

test("SP の開閉ボタンは display: contents の包みが部位の印 header-nav を持ち、ボタン(Primitives/Button)の data-slot=\"button\" は上書きしない", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { SpNavSwitch } = await import("./Header/Sp/SpNavSwitch");
  const html = renderToStaticMarkup(createElement(SpNavSwitch, { isMenuOpen: false, onToggle: () => {} }));
  const wrapper = html.match(/^<[a-z]+[^>]*>/)?.[0] ?? "";
  assert.ok(wrapper.includes('data-slot="header-nav"'), html);
  assert.match(wrapper, /class="[^"]*\bcontents\b/);
  const button = html.match(/<button[^>]*>/)?.[0] ?? "";
  assert.ok(button.includes('data-slot="button"'), "ボタンの data-slot が button でない");
});

// 枠の部位を隠す印(Hide*)と、部位一覧(frameParts.ts)から生成する CSS の検査。
// 実行: pnpm test:frame-controls(tsx + node:test のモジュールモック + react-dom/server の静的描画)
//
// 守りたい契約:
// 1. コミットされた src/styles/_base/frame-controls.generated.css は部位一覧からの生成結果と一致する(pnpm frame:generate --check と同じ関数)
// 2. Hide* は印 <span hidden data-frame-hide> を描くだけ(props 無し = 両方 / sp・pc = そちら / false = 何もしない)
// 3. 部位一覧の狙う先(id と data-frame-part)が既定の枠部品に実在し、外枠に data-frame-root がある
// 4. 生成 CSS は global.css から読まれ、目印の変数を持つ(styles:check-build がビルド出力の欠落を検出できる)
// 5. upstream で Hide* を使う画面・layout の SSR HTML に印が出る
// 6. 隠している間は部位の寸法変数が 0 になり、表示制御の context を読む upstream の部品は無い(context は deprecated の互換だけ)
// :has() の評価とメディアクエリはブラウザでしか確かめられないので見ない(生成 CSS の文字列と SSR の印だけ)。
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ReactNode } from "react";

import { collectDefinedNames } from "../../../../../scripts/styles/builtCss";
import {
  FRAME_CONTROLS_MARKER_VAR,
  FRAME_PARTS,
  buildFrameControlsCss,
  frameHideTokens,
  type FramePart,
} from "./frameParts";

const repoRoot = join(__dirname, "../../../../..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");
const appUrl = (rel: string) => pathToFileURL(join(repoRoot, "src/app", rel)).href;

mock.module(appUrl("(user)/maintenance/_screen/loader.ts"), {
  namedExports: { loadMaintenanceScreen: async () => ({ endTime: null, redirectTo: "/" }) },
});
mock.module(appUrl("(user)/maintenance/_screen/MaintenanceAutoRedirect.tsx"), {
  namedExports: { MaintenanceAutoRedirect: () => null },
});
mock.module(appUrl("(user)/(auth)/demo-login/_screen/loader.ts"), {
  namedExports: { loadDemoLoginScreen: async () => undefined },
});
mock.module(appUrl("(user)/(auth)/demo-login/_screen/DemoLoginSection.tsx"), {
  namedExports: { DemoLoginSection: () => null },
});

let render: (node: ReactNode) => string;
let controls: typeof import("./index");
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  controls = await import("./index");
});

const mark = (tokens: string) => `<span hidden="" data-frame-hide="${tokens}"></span>`;

test("コミットされた生成 CSS は部位一覧からの生成結果と一致する(ずれたら pnpm frame:generate)", () => {
  assert.equal(read("src/styles/_base/frame-controls.generated.css"), buildFrameControlsCss());
});

test("生成 CSS は _base/index.css から config.css の後に読まれ、global.css は _base/index.css を fork のファイルより前に読む", () => {
  const imports = [...read("src/styles/_base/index.css").matchAll(/^@import "([^"]+)";/gm)].map((m) => m[1]);
  const at = imports.indexOf("./frame-controls.generated.css");
  assert.ok(at > imports.indexOf("./config.css"), "config.css の後に無い");
  const entry = [...read("src/styles/global.css").matchAll(/^@import "([^"]+)";/gm)].map((m) => m[1]);
  assert.equal(entry[0], "./_base/index.css", "global.css の最初の @import が _base/index.css でない");
});

test("生成 CSS は目印の変数を宣言する(styles:check-build の検査対象になる)。ほかに宣言するのは部位の寸法変数だけ", () => {
  const names = collectDefinedNames(buildFrameControlsCss());
  assert.ok(names.includes(FRAME_CONTROLS_MARKER_VAR));
  const zeroVars = Object.values(FRAME_PARTS).flatMap((part): readonly string[] => part.zeroVars);
  assert.deepEqual([...new Set(names)].sort(), [FRAME_CONTROLS_MARKER_VAR, ...zeroVars].sort());
});

test("隠す印があるデバイスでは部位の寸法変数を 0 にする(外枠の inline に勝つ !important)", () => {
  const css = buildFrameControlsCss();
  for (const device of ["sp", "pc"]) {
    assert.ok(
      css.includes(`[data-frame-root]:has([data-frame-hide~="bottom-nav-${device}"]) {\n    --app-bottom-nav-height: 0px !important;\n  }`),
      `bottom-nav-${device} で --app-bottom-nav-height が 0 にならない`,
    );
  }
  assert.equal(css.includes("--app-header-height"), false, "ヘッダーの高さは実測なので CSS で 0 にしない");
});

test("生成 CSS は全部位 × 両デバイスの規則を持ち、狙う先は id と data-frame-part の両方", () => {
  const css = buildFrameControlsCss();
  for (const part of Object.keys(FRAME_PARTS) as FramePart[]) {
    for (const device of ["sp", "pc"]) {
      const rule = css.split("\n").find((line) => line.includes(`[data-frame-hide~="${part}-${device}"]`));
      assert.ok(rule, `${part}-${device} の規則が無い`);
      for (const id of FRAME_PARTS[part].ids) assert.ok(rule.includes(`#${id}`), `${part}: #${id} を狙っていない`);
      assert.ok(rule.includes(`[data-frame-part~="${part}"]`), `${part}: data-frame-part を狙っていない`);
    }
  }
});

test("frameHideTokens: props 無し = 両方 / true のデバイスだけ / false は何もしない", () => {
  assert.equal(frameHideTokens("header", {}), "header-sp header-pc");
  assert.equal(frameHideTokens("header", { sp: true }), "header-sp");
  assert.equal(frameHideTokens("header", { pc: true }), "header-pc");
  assert.equal(frameHideTokens("header", { sp: true, pc: true }), "header-sp header-pc");
  assert.equal(frameHideTokens("header", { sp: true, pc: false }), "header-sp");
  assert.equal(frameHideTokens("bottom-nav", { pc: false }), "", "pc={false} は PC に出す指定ではない");
  assert.equal(frameHideTokens("footer", { sp: false, pc: false }), "");
});

test("Hide* は印だけを描き、隠すデバイスが無ければ何も描かない", () => {
  const { HideHeader, HideHeaderNav, HideFooter, HideBottomNav } = controls;
  assert.equal(render(<HideHeader />), mark("header-sp header-pc"));
  assert.equal(render(<HideHeaderNav sp />), mark("header-nav-sp"));
  assert.equal(render(<HideFooter pc />), mark("footer-pc"));
  assert.equal(render(<HideBottomNav />), mark("bottom-nav-sp bottom-nav-pc"));
  assert.equal(render(<HideBottomNav pc={false} />), "");
});

test("Hide* は client 部品ではなく、context も読まない(server からも描ける副作用なしの部品)", () => {
  for (const file of ["HeaderControl.tsx", "HeaderNavControl.tsx", "FooterControl.tsx", "BottomNavControl.tsx", "frameParts.ts"]) {
    const src = read(`src/components/AppFrames/User/controls/${file}`);
    assert.equal(/^["']use client["']/m.test(src), false, `${file} に "use client"`);
    const imports = src.split("\n").filter((line) => /^import\b/.test(line)).join("\n");
    assert.equal(/server-only|\/contexts\/|from "react"/.test(imports), false, `${file} が server-only・context・react の hook を import する`);
  }
});

test("src に表示制御の context(撤去済み)を読む物が無い", () => {
  let out = "";
  try {
    out = execFileSync("git", ["grep", "-l", "-E", "AppFrames/User/contexts|use(Header|HeaderNav|Footer|BottomNav)Visibility", "--", "src"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch {
    // git grep は当たりが 0 件だと exit 1
  }
  const readers = out.split("\n").filter((file) => /\.(ts|tsx|mjs)$/.test(file) && file !== "src/components/AppFrames/User/controls/frameControls.test.tsx");
  assert.deepEqual(readers, []);
});

test("部位一覧の狙う先が既定の枠部品に実在し、外枠に data-frame-root がある", () => {
  const layout = "src/app/(user)/_layout";
  const sources: Record<FramePart, string[]> = {
    header: ["Header/index.tsx"],
    "header-nav": ["Header/Pc/PcNavigation.tsx", "Header/Sp/SpNavSwitch.tsx", "Header/Sp/SpNavigation.tsx"],
    footer: ["Footer/index.tsx"],
    "bottom-nav": ["BottomNav/index.tsx", "BottomNav/BottomNavSpacer.tsx"],
  };
  const constants = read("src/components/AppFrames/constants.ts");
  for (const part of Object.keys(FRAME_PARTS) as FramePart[]) {
    const text = sources[part].map((file) => read(`${layout}/${file}`)).join("\n");
    for (const id of FRAME_PARTS[part].ids) {
      const literal = text.includes(`id="${id}"`);
      const viaConstant = /id=\{APP_(HEADER|FOOTER)_ELEMENT_ID\}/.test(text) && constants.includes(`"${id}"`);
      assert.ok(literal || viaConstant, `${part}: id "${id}" が既定部品に無い`);
    }
    for (const file of sources[part]) {
      assert.ok(read(`${layout}/${file}`).includes(`data-frame-part="${part}"`), `${file} に data-frame-part="${part}" が無い`);
    }
  }
  assert.ok(read(`${layout}/UserLayout.tsx`).includes('data-frame-root=""'));
});

test("upstream で Hide* を使う画面・layout の SSR HTML に印が出る", async () => {
  const { MaintenanceScreen } = await import(appUrl("(user)/maintenance/_screen/MaintenanceScreen.tsx"));
  const maintenance = render(await MaintenanceScreen());
  for (const tokens of ["header-nav-sp header-nav-pc", "footer-sp footer-pc", "bottom-nav-sp bottom-nav-pc"]) {
    assert.ok(maintenance.includes(mark(tokens)), `maintenance に ${tokens} が無い`);
  }

  const { DemoLoginScreen } = await import(appUrl("(user)/(auth)/demo-login/_screen/DemoLoginScreen.tsx"));
  const demoLogin = render(await DemoLoginScreen({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  assert.ok(demoLogin.includes(mark("footer-sp footer-pc")));
  assert.ok(demoLogin.includes(mark("bottom-nav-sp bottom-nav-pc")));

  const { default: SignupLayout } = await import(appUrl("(user)/(auth)/signup/layout.tsx"));
  const signup = render(<SignupLayout>CHILD</SignupLayout>);
  assert.equal(signup, `${mark("bottom-nav-sp bottom-nav-pc")}${mark("footer-sp")}CHILD`);

  const { UserPage } = await import(appUrl("(user)/_layout/UserPage.tsx"));
  const immersive = render(<UserPage immersive>CHILD</UserPage>);
  assert.ok(immersive.startsWith(mark("header-sp header-pc") + mark("footer-sp footer-pc") + mark("bottom-nav-sp bottom-nav-pc")));
});

// fork の口 ForkProviders の 1 行スイッチと上流の既定の検査。実行: pnpm test src/app/_providers/ForkProviders.test.tsx
// 1. スイッチ ForkProviders.tsx はコメントを除くと ./ForkProviders.default か ./ForkProviders.replace の re-export 1 文だけ
//    (Tier1 は既定を指す。fork は notice shared-shelf-override-declarations の通り .replace へ向けてよい)
// 2. 上流の既定 ./ForkProviders.default は children を変えずに描く(空の素通し。スイッチ越しには見ない: fork の .replace は何を描いてもよい)
// 3. 呼び手 AppProviders はスイッチ(@/app/_providers/ForkProviders)を import し、既定や .replace を直接読まない
// スイッチの一覧への載り方は pnpm check extensions(scripts/structure/extensions/switches.mjs)の側
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";


const read = (path: string) => readFileSync(join(__dirname, path), "utf8");
/** 行コメントとブロックコメントを除く(この 2 ファイルの文字列に // や /* は無い) */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

let render: (node: ReactNode) => string;
let ForkProviders: typeof import("./ForkProviders.default").ForkProviders;
let isTier1: boolean;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ ForkProviders } = await import("./ForkProviders.default"));
  const { readForkIdentity } = await import("@/lib/forkOwnership/forkIds.mjs");
  isTier1 = readForkIdentity(join(__dirname, "../../..")).isTier1;
});

test("スイッチ ForkProviders.tsx は ./ForkProviders.default か .replace の re-export 1 文だけ(Tier1 は .default)", () => {
  const statements = stripComments(read("./ForkProviders.tsx"))
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  assert.equal(statements.length, 1, "スイッチに処理が書かれている");
  const target = statements[0].match(/^export \{[^}]*\bForkProviders\b[^}]*\} from "\.\/ForkProviders\.(default|replace)"$/)?.[1];
  assert.ok(target, `スイッチが ./ForkProviders.default か .replace の re-export でない: ${statements[0]}`);
  if (isTier1) assert.equal(target, "default", "Tier1 のスイッチは上流の既定を指す(上流は .replace を出さない)");
});

test("上流の既定 ForkProviders.default は children をそのまま描く", () => {
  const child = (
    <span data-x="1">
      CHILD<b>2</b>
    </span>
  );
  assert.equal(render(<ForkProviders>{child}</ForkProviders>), render(child));
  assert.equal(render(<ForkProviders>{"TEXT"}</ForkProviders>), "TEXT");
});

test("AppProviders はスイッチを import し、既定や .replace を直接読まない", () => {
  const source = read("../../wiring/AppProviders.tsx");
  assert.match(source, /from "@\/app\/_providers\/ForkProviders";/);
  assert.equal(/_providers\/ForkProviders\.(?:default|replace)/.test(stripComments(source)), false);
});

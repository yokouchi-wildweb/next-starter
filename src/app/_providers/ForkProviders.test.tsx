// fork の口 ForkProviders の 1 行スイッチと上流の既定の検査。実行: pnpm test src/app/_providers/ForkProviders.test.tsx
// 1. スイッチ ForkProviders.tsx はコメントを除くと ./ForkProviders.default の re-export 1 文だけ(Tier1 は既定を指す)
// 2. スイッチ越しの ForkProviders は children を変えずに描く(空の素通し)
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
let ForkProviders: typeof import("./ForkProviders").ForkProviders;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ ForkProviders } = await import("./ForkProviders"));
});

test("スイッチ ForkProviders.tsx は ./ForkProviders.default の re-export 1 文だけ", () => {
  const statements = stripComments(read("./ForkProviders.tsx"))
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  assert.equal(statements.length, 1, "スイッチに処理が書かれている");
  assert.match(statements[0], /^export \{[^}]*\bForkProviders\b[^}]*\} from "\.\/ForkProviders\.default"$/);
});

test("スイッチ越しの ForkProviders は children をそのまま描く", () => {
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

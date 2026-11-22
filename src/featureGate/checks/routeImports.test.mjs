// src/featureGate/checks/routeImports.test.mjs
// ルートの閉じ漏れの判定(./routeImports.mjs)の単体: pathPatterns で覆う・ファイルの中で規則の名前で門番に聞く(門番で包む、D54)を通し、
// それ以外は止める。実リポへの当て方は scripts/structure/proxies/featureGate.test.mjs。実行: pnpm test src/featureGate/checks/routeImports.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import { asksGate, findOpenRouteImports } from "./routeImports.mjs";

const RANK = { name: "rankUp", domains: ["rankUp"], pathPatterns: ["/api/me/rank"] };
const OTHER = { name: "other", domains: ["other"], pathPatterns: ["/other"] };
const IMPORT = 'import { RankSection } from "@/domains/rankUp/components/RankSection";\n';
const file = (body, rel = "(user)/mypage/_components/Part.tsx") => ({ rel, segments: ["mypage"], text: `${IMPORT}${body}` });
const open = (rules, files) => findOpenRouteImports(rules, files).map((p) => p.split("（")[0]);

test("通す: 規則の名前で門番に聞く 4 つの形(gate.enabled・gate.required・useGate().enabled・useGate() を受けた名前の enabled)", () => {
  for (const body of [
    'export const show = gate.enabled("rankUp");\n',
    "export async function load() { gate.required('rankUp'); }\n",
    'export function Part() { return useGate().enabled( "rankUp" ) ? null : null; }\n',
    'export function Part() {\n  const g = useGate();\n  return g.enabled("rankUp") ? null : null;\n}\n',
  ]) {
    assert.equal(asksGate(file(body).text, "rankUp"), true, body);
    assert.deepEqual(open([RANK], [file(body)]), [], body);
  }
});

test("止める: 門番に聞かない・別の規則の名前・注釈の中・リテラルでない名前・同じルートの別のファイルで聞く", () => {
  assert.deepEqual(open([RANK], [file("export const x = 1;\n")]), ["(user)/mypage/_components/Part.tsx"]);
  assert.deepEqual(open([RANK], [file('export const x = gate.enabled("payment");\n')]), ["(user)/mypage/_components/Part.tsx"]);
  assert.deepEqual(open([RANK], [file('// gate.enabled("rankUp")\n/* useGate().enabled("rankUp") */\nexport const x = 1;\n')]), ["(user)/mypage/_components/Part.tsx"]);
  assert.deepEqual(open([RANK], [file("const name = \"rankUp\";\nexport const x = gate.enabled(name);\n")]), ["(user)/mypage/_components/Part.tsx"]);
  // 同じルートの loader が聞いても、部品のファイルは自分で聞かなければ止める(同じファイルの中だけ)
  const loader = file('export const load = () => gate.enabled("rankUp");\n', "(user)/mypage/_screen/loader.ts");
  assert.deepEqual(open([RANK], [loader, file("export const x = 1;\n")]), ["(user)/mypage/_components/Part.tsx"]);
  // 別名の gate(otherGate.enabled)は数えない
  assert.equal(asksGate('export const x = otherGate.enabled("rankUp");\n', "rankUp"), false);
});

test("規則ごとに見る: 2 つのドメインを読むファイルは、読む規則それぞれの名前で聞く", () => {
  const both = { rel: "api/x/route.ts", segments: ["api", "x"], text: `${IMPORT}import { o } from "@/domains/core/other/lib/o";\nexport const a = gate.enabled("rankUp");\n` };
  assert.deepEqual(findOpenRouteImports([RANK, OTHER], [both]).map((p) => p.split("（")[0]), ["api/x/route.ts"]);
  assert.match(findOpenRouteImports([RANK, OTHER], [both])[0], /規則「other」/);
  const asked = { ...both, text: `${both.text}export const b = gate.enabled("other");\n` };
  assert.deepEqual(findOpenRouteImports([RANK, OTHER], [asked]), []);
});

test("今までの通し方はそのまま: pathPatterns が覆うルートは聞かなくても通り、domains の無い規則は見ない", () => {
  const rankRoute = { rel: "api/me/rank/route.ts", segments: ["api", "me", "rank"], text: IMPORT };
  assert.deepEqual(open([RANK], [rankRoute]), []);
  assert.deepEqual(open([{ name: "plain", pathPatterns: ["/plain"] }], [file("export const x = 1;\n")]), []);
});

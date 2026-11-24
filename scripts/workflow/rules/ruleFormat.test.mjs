// scripts/workflow/rules/ruleFormat.test.mjs
// 書式の検査(lib.ruleFormat.mjs)の振る舞い: 札・README・対応表 existing_parts。実行: pnpm test scripts/workflow/rules/ruleFormat.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardId, cardProblems, countLineTarget, existingPartRefs, h2Of, readmeProblems, receptaclePath, receptaclePointsOf } from "./lib.ruleFormat.mjs";

const PATH = ".claude/rules/items/lib/storage.md";
const FOLDER = "src/lib/storage";
const README_H2 = { "src/lib/storage/README.md": ["Overview", "Usage", "API"], "src/lib/storage/API.md": ["Overview", "API"] };
const readmeH2 = (file) => README_H2[file] ?? null;

const card = (over = {}) => {
  const parts = {
    fm: '---\npaths:\n  - "src/lib/storage/**"\n  - "src/config/lib/storage.config.ts"\n---\n',
    title: "# lib/storage\n",
    what: "what: GCS への直接アップロードと画像のメタデータの除去。入口 @/lib/storage\n",
    use: "use: always\n",
    change: "change: placement src/config/lib/storage.config.ts\n",
    rules: "rules:\nusing:\n- strip: 画像は既定で strip\nediting:\n- signed: 署名付き URL だけを返す\n",
    read: "read: アップロードを足す → Usage | 型を見る → API | 分けた詳細 → src/lib/storage/API.md API\n",
    ...over,
  };
  return parts.fm + parts.title + parts.what + parts.use + parts.change + parts.rules + parts.read;
};
const problems = (text, folder = FOLDER, path = PATH) => cardProblems({ path, text, itemFolder: folder, readmeH2 });

test("札: 正しい 1 枚は問題 0", () => {
  assert.deepEqual(problems(card()), []);
});

test("札: 置き場・品目のフォルダ・字数", () => {
  assert.equal(cardId(".claude/rules/items/lib/storage.md").name, "storage");
  assert.ok(problems(card(), FOLDER, ".claude/rules/items/storage.md")[0].includes("置き場"));
  assert.ok(problems(card(), FOLDER, ".claude/rules/items/hooks/x.md").some((p) => p.includes("category")));
  assert.ok(problems(card(), null).some((p) => p.includes("品目のフォルダが無い")));
  assert.ok(problems(card({ what: `what: ${"x".repeat(10000)}\n` })).some((p) => p.includes("10000 字")));
});

test("札: frontmatter は paths だけ・paths は品目のフォルダとその設定の中", () => {
  assert.ok(problems(card({ fm: '---\npaths:\n  - "src/lib/storage/**"\ndescription: x\n---\n' })).some((p) => p.includes("paths だけ")));
  assert.ok(problems(card({ fm: '---\npaths:\n  - "src/lib/**"\n---\n' })).some((p) => p.includes("src/lib/** が品目")));
  assert.ok(problems(card({ title: "# storage\n" })).some((p) => p.includes("題")));
});

test("札: paths に宣言した受け口の置き場を通し、Tier1 では全部を求める(D318)、fork の自分の札には何も言わない", () => {
  const withPaths = (...extra) => card({ fm: `---\npaths:\n  - "src/lib/storage/**"\n${extra.map((p) => `  - "${p}"\n`).join("")}---\n` });
  const run = (text, plugsPoints, requireReceptacles) => cardProblems({ path: PATH, text, itemFolder: FOLDER, readmeH2, plugsPoints, requireReceptacles });
  // 形: 1 つの名前・波かっこ 1 組の並び・地区つき
  assert.deepEqual(receptaclePointsOf("src/**/plugs/storagePurposes/**"), ["storagePurposes"]);
  assert.deepEqual(receptaclePointsOf("src/**/plugs/{a,b}/**"), ["a", "b"]);
  assert.deepEqual(receptaclePointsOf("src/domains/**/plugs/a/**"), ["a"]);
  assert.equal(receptaclePointsOf("src/**/plugs/a/*.ts"), null);
  assert.equal(receptaclePath(["b", "a"]), "src/**/plugs/{a,b}/**");
  assert.equal(receptaclePath(["a"]), "src/**/plugs/a/**");
  // 宣言した点だけ通る
  assert.deepEqual(run(withPaths("src/**/plugs/{a,b}/**"), ["a", "b"], true), []);
  assert.ok(run(withPaths("src/**/plugs/{a,c}/**"), ["a", "b"], false).some((p) => p.includes("受け口 c を品目は宣言していない")));
  // Tier1: 宣言した点の置き場が無ければ止める、fork(requireReceptacles false): 何も言わない
  assert.ok(run(withPaths("src/**/plugs/a/**"), ["a", "b"], true).some((p) => p.includes("受け口 b の置き場が paths に無い(src/**/plugs/b/**)")));
  assert.deepEqual(run(withPaths(), ["a", "b"], false), []);
  // 点を持たない品目は今までどおり
  assert.deepEqual(run(withPaths(), [], true), []);
});

test("札: 欄の順・rules の分け・鍵の重なり", () => {
  const swapped = card({ use: "change: x\n", change: "use: always\n" });
  assert.ok(problems(swapped).some((p) => p.includes("順")));
  assert.ok(problems(card({ rules: "rules:\n- a: x\n" })).some((p) => p.includes("using: と editing:")));
  assert.ok(problems(card({ rules: "rules:\nusing:\n- a: x\nediting:\n- a: y\n" })).some((p) => p.includes("重なる: a")));
});

test("札: read の README の h2 が無い・別の文書が無いと問題", () => {
  assert.ok(problems(card({ read: "read: x → Internals\n" })).some((p) => p.includes("h2 Internals")));
  assert.ok(problems(card({ read: "read: x → src/lib/storage/Gone.md API\n" })).some((p) => p.includes("Gone.md が無い")));
});

test("README: h2 の語・順・Overview・字数", () => {
  assert.deepEqual(readmeProblems("# x\n## Overview\na\n## Usage\n## Related\n"), []);
  assert.ok(readmeProblems("# x\n## Usage\n").some((p) => p.includes("Overview")));
  assert.ok(readmeProblems("# x\n## Overview\n## 使い方\n").some((p) => p.includes("決まった語でない")));
  assert.ok(readmeProblems("# x\n## Overview\n## API\n## Usage\n").some((p) => p.includes("順")));
  assert.ok(readmeProblems(`## Overview\n${"x".repeat(40001)}`).some((p) => p.includes("40000")));
  assert.deepEqual(h2Of("## Overview\n```\n## not\n```\n"), ["Overview"]);
});

test("対応表 existing_parts: → の先の部品と @/lib を取り出す(→ の前と次の鍵は見ない)", () => {
  const text = [
    "components: x",
    "existing_parts (want → part; check here):",
    "- loading: inside a button → Form/Button loading prop | over the screen → Overlays/Loading/ScreenLoader",
    "- table (@/lib/tableSuite): list → DataTable | toast → @/lib/toast",
    "next_key: → Gone/Part",
  ].join("\n");
  assert.deepEqual(existingPartRefs(text).map((r) => `${r.kind}:${r.ref}`), ["component:Form/Button", "component:Overlays/Loading/ScreenLoader", "lib:toast"]);
  assert.deepEqual(existingPartRefs("no key here"), []);
});

test("札の無い Tier1 の品目・上流の README の書式の数の 1 行: Tier1 は止める、fork は知らせ", () => {
  assert.equal(countLineTarget(true), "fail");
  assert.equal(countLineTarget(false), "notify");
});

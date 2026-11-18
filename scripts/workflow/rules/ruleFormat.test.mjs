// scripts/workflow/rules/ruleFormat.test.mjs
// 書式の検査(lib.ruleFormat.mjs)の振る舞い: 札・README・対応表 existing_parts。実行: pnpm test scripts/workflow/rules/ruleFormat.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardId, cardProblems, existingPartRefs, h2Of, readmeProblems } from "./lib.ruleFormat.mjs";

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
  assert.ok(problems(card({ what: `what: ${"x".repeat(2000)}\n` })).some((p) => p.includes("2000 字")));
});

test("札: frontmatter は paths だけ・paths は品目のフォルダとその設定の中", () => {
  assert.ok(problems(card({ fm: '---\npaths:\n  - "src/lib/storage/**"\ndescription: x\n---\n' })).some((p) => p.includes("paths だけ")));
  assert.ok(problems(card({ fm: '---\npaths:\n  - "src/lib/**"\n---\n' })).some((p) => p.includes("src/lib/** が品目")));
  assert.ok(problems(card({ title: "# storage\n" })).some((p) => p.includes("題")));
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
  assert.ok(readmeProblems(`## Overview\n${"x".repeat(20001)}`).some((p) => p.includes("20000")));
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

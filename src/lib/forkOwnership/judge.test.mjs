// 受け口の一覧・判定の核・生成器の区画の検査(pnpm test:fork-ownership)
// - 実リポジトリの intake.txt の書式と、書かれた glob が実在のパスに当たること
// - judge の各判定(fixture は文字列)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { matchIntake, parseIntake } from "./intake.mjs";
import { judge, REASONS } from "./judge.mjs";
import { FORK_REGION_END, FORK_REGION_START, parseGeneratorRegions, stripOwnedRegions } from "./regions.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const S = FORK_REGION_START;
const E = FORK_REGION_END;

describe("実リポジトリの intake.txt", () => {
  const { rules, errors } = parseIntake(readFileSync(join(ROOT, "src/lib/forkOwnership/intake.txt"), "utf8"));

  test("書式の誤りが無い", () => {
    assert.deepEqual(errors, []);
    assert.ok(rules.length > 0);
  });

  // fork だけが作るファイル(_components/・override.ts 等)は upstream に無いので、glob そのものではなく
  // 最初の `*` より前の固定の部分(ディレクトリまたはファイル)が実在することを見る(パスの書き違い・移動の検出)
  test("glob の固定の部分が実在する(一覧の鮮度)", () => {
    const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
    const literalPrefix = (glob) => {
      const wildcard = glob.search(/[*?[{]/);
      return wildcard === -1 ? glob : glob.slice(0, glob.lastIndexOf("/", wildcard) + 1);
    };
    const stale = rules
      .filter((rule) => rule.kind !== "generated" && rule.kind !== "debt")
      .filter((rule) => {
        const prefix = literalPrefix(rule.glob);
        return !files.some((file) => (prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix));
      })
      .map((rule) => `intake.txt:${rule.line} ${rule.kind ?? "!"} ${rule.glob}`);
    assert.deepEqual(stale, [], `実在しない場所を指す規則:\n${stale.join("\n")}`);
  });

  test("代表のパスが期待の kind になる", () => {
    const cases = [
      ["package.json", "edit"],
      ["src/config/app/app-features.config.ts", "edit"],
      ["src/styles/palette.css", "edit"],
      ["src/styles/_base/global.css", null],
      ["src/app/(user)/(public)/about/page.tsx", "edit"],
      ["src/app/(user)/_layout/UserLayout.acme.tsx", "edit"],
      ["src/app/(user)/_layout/UserLayout.test.tsx", null],
      ["src/app/(user)/_layout/UserLayout.tsx", null],
      ["src/registry/coinIssuanceRegistry.ts", "region"],
      ["src/registry/serviceRegistry.ts", "generated"],
      [".claude/rules/shortcuts.md", "marker"],
      ["src/lib/CATALOG.md", "append"],
      ["src/features/core/user/services/server/userService.ts", null],
      ["eslint.config.mjs", null],
    ];
    for (const [path, kind] of cases) {
      assert.equal(matchIntake(rules, path)?.kind ?? null, kind, path);
    }
  });
});

describe("parseIntake / matchIntake", () => {
  test("書式の誤り", () => {
    const { errors } = parseIntake(["edit a/**", "bogus x  # r", "edit  # r", "!a b"].join("\n"));
    assert.equal(errors.length, 4);
  });

  test("最後に当たった規則が効き、! はそれまでの当たりを外す", () => {
    const { rules } = parseIntake(["edit src/**  # r", "region src/registry/**  # r", "!src/registry/x.ts"].join("\n"));
    assert.equal(matchIntake(rules, "src/a.ts").kind, "edit");
    assert.equal(matchIntake(rules, "src/registry/y.ts").kind, "region");
    assert.equal(matchIntake(rules, "src/registry/x.ts"), null);
  });
});

describe("生成器の区画", () => {
  test("対の 2 書式と、終わりの印の無い import の区画", () => {
    const text = [
      "// --- Core imports ---",
      'import a from "a";',
      "// --- Auto-generated imports ---",
      'import b from "b";',
      "",
      'import c from "c";',
      "export const x = [",
      "  // --- AUTO-GENERATED-START ---",
      "  b,",
      "  // --- AUTO-GENERATED-END ---",
      "  // === AUTO-GENERATED ENTRIES START ===",
      "  c,",
      "  // === AUTO-GENERATED ENTRIES END ===",
      "];",
    ].join("\n");
    assert.deepEqual(parseGeneratorRegions(text), [
      { start: 3, end: 7 },
      { start: 8, end: 10 },
      { start: 11, end: 13 },
    ]);
    assert.doesNotMatch(stripOwnedRegions(text), /import b|import c|^\s+b,|^\s+c,/m);
    assert.match(stripOwnedRegions(text), /import a/);
  });
});

describe("judge", () => {
  const { rules: intake } = parseIntake(
    [
      "edit src/config/**  # r",
      "region src/registry/**/*.ts  # r",
      "generated src/registry/serviceRegistry.ts  # r",
      "marker .claude/rules/shortcuts.md  # r",
      "append src/lib/CATALOG.md  # r",
      "debt src/features/core/mail/templates/**  # r",
    ].join("\n"),
  );

  const run = (change, base, head, baseLibs = []) =>
    judge({ changes: [change], baseText: () => base, headText: () => head, baseLibs, intake }).entries[0];

  test("A: fork の物 / 祖先 lib の中は違反", () => {
    assert.equal(run({ status: "A", path: "src/features/gacha/x.ts" }, null, "x").reason, "added");
    assert.equal(run({ status: "A", path: "src/lib/myLib/x.ts" }, null, "x", ["crud"]).reason, "added");
    const entry = run({ status: "A", path: "src/lib/crud/extra.ts" }, null, "x", ["crud"]);
    assert.equal(entry.reason, "ancestor-lib-add");
    assert.equal(entry.verdict, "violation");
  });

  test("D・R は受け口の中でも違反", () => {
    assert.equal(run({ status: "D", path: "src/config/app/x.config.ts" }, "x", null).reason, "deleted");
    assert.equal(run({ status: "R100", from: "src/app/a/page.tsx", path: "src/app/_a/page.tsx" }, "x", "x").reason, "renamed");
  });

  test("M: 受け口の中 / 外 / 生成物 / 負債", () => {
    assert.equal(run({ status: "M", path: "src/config/app/x.config.ts" }, "a", "b").reason, "intake");
    assert.equal(run({ status: "M", path: "src/features/core/user/x.ts" }, "a", "b").reason, "outside-intake");
    assert.equal(run({ status: "M", path: "src/registry/serviceRegistry.ts" }, "a", "b").reason, "generated");
    assert.equal(run({ status: "M", path: "src/features/core/mail/templates/x.tsx" }, "a", "b").reason, "debt");
  });

  test("M: 受け口の外でも生成器の区画の中だけなら合格", () => {
    const base = ["export const m = [", "  // --- AUTO-GENERATED-START ---", "  // --- AUTO-GENERATED-END ---", "];"].join("\n");
    const head = ["export const m = [", "  // --- AUTO-GENERATED-START ---", "  { a: 1 },", "  // --- AUTO-GENERATED-END ---", "];"].join("\n");
    assert.equal(run({ status: "M", path: "src/other/menu.ts" }, base, head).reason, "generator-region");
  });

  test("M: 受け口の外のファイルに fork の区画の印を足しても合格にならない", () => {
    const head = ["x", S, "fork", E].join("\n");
    assert.equal(run({ status: "M", path: "src/features/core/user/x.ts" }, "x", head).reason, "outside-intake");
  });

  test("M(region): fork の区画の中だけ / 外にも / 印が壊れている", () => {
    const base = ['import a from "a";', S, E, "export const r = [", "  a,", `  ${S}`, `  ${E}`, "];"].join("\n");
    const inside = ['import a from "a";', S, 'import f from "f";', E, "export const r = [", "  a,", `  ${S}`, "  f,", `  ${E}`, "];"].join("\n");
    const outside = inside.replace("  a,", "  a,\n  g,");
    const broken = inside.replace(`  ${E}`, "");
    const path = "src/registry/x.ts";
    assert.equal(run({ status: "M", path }, base, inside).reason, "region");
    assert.equal(run({ status: "M", path }, base, outside).reason, "outside-region");
    assert.equal(run({ status: "M", path }, base, broken).reason, "region-markers");
  });

  test("M(marker): 印より下だけ / 上も", () => {
    const base = ["# s", "a: 1", "<!-- fork entries below (upstream never edits below this line) -->"].join("\n");
    const path = ".claude/rules/shortcuts.md";
    assert.equal(run({ status: "M", path }, base, `${base}\nmine: 2`).reason, "marker");
    assert.equal(run({ status: "M", path }, base, base.replace("a: 1", "a: 9")).reason, "above-marker");
    assert.equal(run({ status: "M", path }, base, "a: 1").reason, "above-marker");
  });

  test("M(append): 追記だけ / 基準を変えた", () => {
    const base = "## upstream\n- src/lib/a — x\n";
    const path = "src/lib/CATALOG.md";
    assert.equal(run({ status: "M", path }, base, `${base}\n## fork\n- src/lib/b — y\n`).reason, "append");
    assert.equal(run({ status: "M", path }, base, base.replace("x", "z")).reason, "not-append");
  });

  test("件数と、すべての reason に verdict がある", () => {
    const result = judge({
      changes: [
        { status: "A", path: "a" },
        { status: "A", path: "b" },
        { status: "D", path: "c" },
      ],
      baseText: () => "x",
      headText: () => null,
      baseLibs: [],
      intake,
    });
    assert.deepEqual(result.counts, { added: 2, deleted: 1 });
    for (const verdict of Object.values(REASONS)) assert.ok(verdict === "ok" || verdict === "violation");
  });
});

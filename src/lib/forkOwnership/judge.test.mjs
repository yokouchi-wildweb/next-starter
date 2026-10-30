// 受け口の一覧・判定の核・生成器の区画の検査(pnpm test:fork-ownership)
// - 実リポジトリの intake.txt の書式と、書かれた glob が実在のパスに当たること
// - judge の各判定(fixture は文字列)
// - 一時許可の書式・指紋・照合
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { matchIntake, parseIntake } from "./intake.mjs";
import { judge, REASONS } from "./judge.mjs";
import { blobId, checkPermits, fingerprint, parsePermits, permitsPath } from "./permits.mjs";
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
  // 最初の `*` より前の固定の部分(ディレクトリまたはファイル)が実在することを見る(パスの書き違い・移動の検出)。
  // fork が作るファイルを名指しする行(upstream には .example だけ等)は、理由に「upstream には無い」と書いて外す
  test("glob の固定の部分が実在する(一覧の鮮度)", () => {
    const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
    const literalPrefix = (glob) => {
      const wildcard = glob.search(/[*?[{]/);
      return wildcard === -1 ? glob : glob.slice(0, glob.lastIndexOf("/", wildcard) + 1);
    };
    const stale = rules
      .filter((rule) => rule.kind !== "generated" && rule.kind !== "debt" && !rule.note.includes("upstream には無い"))
      .filter((rule) => {
        const prefix = literalPrefix(rule.glob);
        return !files.some((file) => (prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix));
      })
      .map((rule) => `intake.txt:${rule.line} ${rule.kind ?? "!"} ${rule.glob}`);
    assert.deepEqual(stale, [], `実在しない場所を指す規則:\n${stale.join("\n")}`);
  });

  test("負債の行は実在のファイルを指し、理由に受け口づくりの依頼の番号がある(件数を出す)", (t) => {
    const files = new Set(execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));
    const debt = rules.filter((rule) => rule.kind === "debt");
    t.diagnostic(`upstream の負債の行: ${debt.length}`);
    const bad = debt
      .filter((rule) => !files.has(rule.glob) || !/upreq:\d{8}-\d{6}-[a-z0-9-]+/.test(rule.note))
      .map((rule) => `intake.txt:${rule.line} ${rule.glob}`);
    assert.deepEqual(bad, [], `実在しないか依頼の番号の無い負債の行:\n${bad.join("\n")}`);
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
      ["src/registry/storagePurposeRegistry.ts", "generated"],
      ["src/registry/serviceRegistry.ts", "generated"],
      [".claude/rules/shortcuts.md", "marker"],
      ["src/lib/CATALOG.md", "append"],
      ["src/features/core/user/services/server/userService.ts", null],
      ["src/features/core/setting/setting.extended.ts", "debt"],
      ["eslint.config.mjs", null],
      ["eslint.config.fork.mjs", "edit"],
      ["tsconfig.json", null],
      ["AGENTS.md", null],
      ["public/assets/imgs/logos/default.png", "edit"],
      ["servers/room/src/registry.ts", "region"],
      ["scripts/db/seed/data/registry.ts", "region"],
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

  test("M: Next が AGENTS.md に書き足す区画は印の行ごと除く", () => {
    const base = "# AGENTS.md\n- rule\n";
    const head = `${base}\n<!-- BEGIN:nextjs-agent-rules -->\n\n# Next\ntext\n<!-- END:nextjs-agent-rules -->\n`;
    assert.equal(run({ status: "M", path: "AGENTS.md" }, base, head).reason, "generator-region");
    assert.equal(run({ status: "M", path: "AGENTS.md" }, base, head.replace("- rule", "- mine")).reason, "outside-intake");
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

describe("一時許可", () => {
  const { rules: intake } = parseIntake(["region src/registry/**/*.ts  # r", "edit src/config/**  # r"].join("\n"));
  const ID = "20261029-120000-core-hook";
  const ID2 = "20261029-130000-another";

  test("置き場は fork-id ごと", () => {
    assert.equal(permitsPath("acme--shop"), ".fork-ownership/acme--shop.permits.txt");
  });

  test("blobId は git hash-object --stdin と同じ", () => {
    for (const text of ["", "a\n", "日本語\nline 2"]) {
      const expected = execFileSync("git", ["hash-object", "--stdin"], { input: text, encoding: "utf8" }).trim();
      assert.equal(blobId(text), expected);
    }
    assert.equal(blobId(null), "-");
  });

  test("指紋は区画の中身を除いて取る(region は fork の区画も、他は生成器の区画だけ)", () => {
    const a = ["x", S, "one", E].join("\n");
    const b = ["x", S, "two", E].join("\n");
    assert.equal(fingerprint(a, "region"), fingerprint(b, "region"));
    assert.notEqual(fingerprint(a, null), fingerprint(b, null));
  });

  test("書式の誤り: 依頼番号なし・番号の形・指紋の形・両方 -・理由なし・重複", () => {
    const fp = "a".repeat(40);
    const text = [
      `src/a.ts upreq: base:${fp} head:${fp}  # r`,
      `src/b.ts upreq:123 base:${fp} head:${fp}  # r`,
      `src/c.ts upreq:${ID} base:xyz head:${fp}  # r`,
      `src/d.ts upreq:${ID} base:- head:-  # r`,
      `src/e.ts upreq:${ID} base:${fp} head:${fp}`,
      `src/f.ts upreq:${ID} base:${fp} head:${fp}  # r`,
      `src/f.ts upreq:${ID} base:${fp} head:${fp}  # r`,
    ].join("\n");
    const { permits, errors } = parsePermits(text);
    assert.deepEqual([...new Set(errors.map((error) => error.line))], [1, 2, 3, 4, 5, 7]);
    assert.deepEqual(permits.map((permit) => permit.path), ["src/f.ts"]);
  });

  const BASE = "export const a = 1;\n";
  const HEAD = "export const a = 2;\n";
  const PATH = "src/features/core/user/x.ts";
  const texts = { base: { [PATH]: BASE }, head: { [PATH]: HEAD } };

  const run = ({ permitText, entries, resolved = [], base = texts.base, head = texts.head }) => {
    const { permits, errors } = parsePermits(permitText);
    assert.deepEqual(errors, []);
    return checkPermits({
      entries,
      permits,
      baseText: (path) => base[path] ?? null,
      headText: (path) => head[path] ?? null,
      intake,
      resolvedUpreqs: resolved,
    });
  };
  const violation = { status: "M", path: PATH, kind: null, reason: "outside-intake", verdict: "violation" };
  const line = (path, upreqs, baseFp, headFp) => `${path} upreq:${upreqs} base:${baseFp} head:${headFp}  # r`;

  test("有効な許可は違反を合格(permitted)にする / 許可の無い違反はそのまま", () => {
    const valid = run({ permitText: line(PATH, ID, blobId(BASE), blobId(HEAD)), entries: [violation] });
    assert.equal(valid.entries[0].permit, "valid");
    assert.equal(valid.entries[0].verdict, "permitted");
    const none = run({ permitText: "", entries: [violation] });
    assert.equal(none.entries[0].permit, "none");
    assert.equal(none.entries[0].verdict, "violation");
  });

  test("fork 側が変わった = 許可し直し / 基準側が変わった = 失効 / 全番号の解決 = 失効(一部だけなら有効)", () => {
    const refresh = run({ permitText: line(PATH, ID, blobId(BASE), blobId("old")), entries: [violation] });
    assert.equal(refresh.entries[0].permit, "refresh");
    const expiredBase = run({ permitText: line(PATH, ID, blobId("older base"), blobId(HEAD)), entries: [violation] });
    assert.equal(expiredBase.entries[0].permit, "expired-base");
    const resolved = run({ permitText: line(PATH, `${ID},${ID2}`, blobId(BASE), blobId(HEAD)), entries: [violation], resolved: [ID, ID2] });
    assert.equal(resolved.entries[0].permit, "expired-resolved");
    const partly = run({ permitText: line(PATH, `${ID},${ID2}`, blobId(BASE), blobId(HEAD)), entries: [violation], resolved: [ID] });
    assert.equal(partly.entries[0].permit, "valid");
    for (const result of [refresh, expiredBase, resolved]) assert.equal(result.entries[0].verdict, "violation");
  });

  test("D と R の許可は head:-、R は移動元のパスに書く。祖先 lib への追加は base:-", () => {
    const deleted = { status: "D", path: PATH, kind: null, reason: "deleted", verdict: "violation" };
    assert.equal(run({ permitText: line(PATH, ID, blobId(BASE), "-"), entries: [deleted] }).entries[0].permit, "valid");
    const renamed = { status: "R", from: PATH, path: "src/features/core/user/_x.ts", kind: null, reason: "renamed", verdict: "violation" };
    assert.equal(run({ permitText: line(PATH, ID, blobId(BASE), "-"), entries: [renamed] }).entries[0].permit, "valid");
    const libPath = "src/lib/crud/extra.ts";
    const added = { status: "A", path: libPath, kind: null, reason: "ancestor-lib-add", verdict: "violation" };
    const result = run({ permitText: line(libPath, ID, "-", blobId("x")), entries: [added], head: { [libPath]: "x" } });
    assert.equal(result.entries[0].permit, "valid");
  });

  test("残骸: 基準と同じに戻った行 / 違反の無いファイルの行", () => {
    const cfg = "src/config/app/x.config.ts";
    const result = run({
      permitText: [line(PATH, ID, blobId(BASE), blobId(HEAD)), line(cfg, ID, blobId("a"), blobId("b"))].join("\n"),
      entries: [{ status: "M", path: cfg, kind: "edit", reason: "intake", verdict: "ok" }],
      head: { [PATH]: BASE, [cfg]: "b" },
      base: { [PATH]: BASE, [cfg]: "a" },
    });
    assert.deepEqual(
      result.leftovers.map(({ path, reason }) => [path, reason]),
      [
        [PATH, "same-as-base"],
        [cfg, "unused"],
      ],
    );
  });

  test("region の許可は fork の区画を除いた指紋で照合する(区画の中の追記で許可し直しにならない)", () => {
    const path = "src/registry/x.ts";
    const base = ["export const r = [", "  a,", `  ${S}`, `  ${E}`, "];"].join("\n");
    const head = ["export const r = [", "  a2,", `  ${S}`, "  f,", `  ${E}`, "];"].join("\n");
    const moreForkEntries = head.replace("  f,", "  f,\n  g,");
    const entry = { status: "M", path, kind: "region", reason: "outside-region", verdict: "violation" };
    const permitText = line(path, ID, fingerprint(base, "region"), fingerprint(head, "region"));
    const result = run({ permitText, entries: [entry], base: { [path]: base }, head: { [path]: moreForkEntries } });
    assert.equal(result.entries[0].permit, "valid");
  });
});

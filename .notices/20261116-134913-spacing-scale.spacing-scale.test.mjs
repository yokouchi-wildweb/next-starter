// .notices/20261116-134913-spacing-scale.spacing-scale.test.mjs
// 実行: pnpm test .notices

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMPONENT_PROPS,
  STEPS,
  TABLE_FILES,
  classesToPx,
  formatMappingTable,
  loadSpacingTables,
  README_TABLE_MARKS,
  parseArgs,
  resultToPx,
  run,
  transformSource,
} from "./20261116-134913-spacing-scale.spacing-scale.mjs";


// 手書きの写し(今の Layout の表)。ファイルの表が変わればここと食い違って落ちる
const HAND_TABLES = {
  common: {
    padding: { none: "p-0", xs: "p-1", sm: "p-2", md: "p-3 sm:p-4", lg: "p-4 sm:p-6", xl: "p-6 sm:p-10", xxl: "p-10 sm:p-16", xxxl: "p-16 sm:p-24" },
    paddingBlock: { none: "py-0", xs: "py-1", sm: "py-2", md: "py-3 sm:py-4", lg: "py-4 sm:py-6", xl: "py-6 sm:py-10", xxl: "py-10 sm:py-16", xxxl: "py-16 sm:py-24" },
    paddingInline: { none: "px-0", xs: "px-1", sm: "px-2", md: "px-3 sm:px-4", lg: "px-4 sm:px-6", xl: "px-6 sm:px-10", xxl: "px-10 sm:px-16", xxxl: "px-16 sm:px-24" },
    margin: { none: "m-0", xs: "m-1", sm: "m-2", md: "m-4", lg: "m-6", xl: "m-10", xxl: "m-16", xxxl: "m-24" },
    marginBlock: { none: "my-0", xs: "my-1", sm: "my-2", md: "my-4", lg: "my-6", xl: "my-10", xxl: "my-16", xxxl: "my-24" },
    marginInline: { none: "mx-0", xs: "mx-1", sm: "mx-2", md: "mx-4", lg: "mx-6", xl: "mx-10", xxl: "mx-16", xxxl: "mx-24" },
  },
  Grid: {
    gap: { none: "gap-0", xs: "gap-1", sm: "gap-2", md: "gap-4", lg: "gap-6", xl: "gap-8", xxl: "gap-12" },
    columnGap: { none: "", xs: "gap-x-1", sm: "gap-x-2", md: "gap-x-4", lg: "gap-x-6", xl: "gap-x-8", xxl: "gap-x-12" },
    rowGap: { none: "", xs: "gap-y-1", sm: "gap-y-2", md: "gap-y-4", lg: "gap-y-6", xl: "gap-y-8", xxl: "gap-y-12" },
  },
  Flex: {
    gap: { none: "gap-0", xs: "gap-2", sm: "gap-4", md: "gap-6", lg: "gap-8", xl: "gap-12", xxl: "gap-16" },
  },
  Stack: {
    space: Object.fromEntries(
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96].map(
        (n) => [String(n), `gap-${n}`],
      ),
    ),
  },
};

// 書き換え前の Layout の 4 ファイル(と既定値を読む部品のファイル)の見本。上流はこの区切りで旧表を消したので、
// テストは今の木ではなく、この見本(= 手書きの写しから組んだ旧い形のソース)から読む。
// 見本は書き換え前のコミット(余白の区切りの直前)の実物と同じ表・既定値になる(d5 の 1 件目が確かめる)
const literal = (record) => `{ ${Object.entries(record).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
const OLD_SOURCES = {
  "src/components/Layout/commonVariants.ts": Object.entries(HAND_TABLES.common)
    .map(([prop, record]) => `export const ${prop} = ${literal(record)} as const;`)
    .join("\n"),
  "src/components/Layout/Grid.tsx": [
    `const gridVariantDefinitions = { gap: ${literal(HAND_TABLES.Grid.gap)}, columnGap: ${literal(HAND_TABLES.Grid.columnGap)}, rowGap: ${literal(HAND_TABLES.Grid.rowGap)} } as const;`,
    `export function Grid({ gap = "none", columnGap, rowGap, autoFlow = "row", alignItems = "stretch", justifyItems = "stretch", justifyContent = "start" }) { return null; }`,
  ].join("\n"),
  "src/components/Layout/Flex.tsx": [
    `const flexVariantDefinitions = { gap: ${literal(HAND_TABLES.Flex.gap)} } as const;`,
    `export function Flex({ gap = "none", direction = "row", align = "stretch", justify = "start", wrap = "nowrap" }) { return null; }`,
  ].join("\n"),
  "src/components/Layout/Stack.tsx": [
    `const SPACING_SCALE = [${Object.keys(HAND_TABLES.Stack.space).join(", ")}] as const;`,
    `export function Stack({ space = 0 }) { return null; }`,
  ].join("\n"),
  "src/components/Layout/Main.tsx": `export function Main({ padding = "md", verticalAlign = "center" }) { return null; }`,
  "src/components/Layout/Block.tsx": `export function Block({ padding }) { return null; }`,
  "src/components/Layout/InBlock.tsx": `export function InBlock({ padding }) { return null; }`,
  "src/components/Layout/Section.tsx": `export function Section({ padding }) { return null; }`,
};
const readOld = (rel) => {
  if (!(rel in OLD_SOURCES)) throw new Error(`見本に無い: ${rel}`);
  return OLD_SOURCES[rel];
};
const { tables, mapping, defaults } = loadSpacingTables(readOld);

const tsx = (body, imports = `import { Block, Flex, Grid, Main, Section, Stack } from "@/components/Layout";`) => `${imports}\n${body}\n`;
const go = (source, options = {}) => transformSource(source, { mapping, defaults, ...options });

// ---------------------------------------------------------------- d5 旧表はファイルから

test("d5: 旧表は Layout の 4 ファイル(の見本)から読み、手書きの写しと一致する。既定値は書き換え前の実物と同じ", () => {
  assert.deepEqual(tables, HAND_TABLES);
  // 書き換え前のコミット(余白の区切りの直前、上流)の loadDefaults の結果
  assert.deepEqual(defaults, {
    Block: {},
    InBlock: {},
    Section: {},
    Main: { padding: "md", verticalAlign: "center" },
    Flex: { gap: "none", direction: "row", align: "stretch", justify: "start", wrap: "nowrap" },
    Grid: { gap: "none", autoFlow: "row", alignItems: "stretch", justifyItems: "stretch", justifyContent: "start" },
    Stack: { space: "0" },
  });
  assert.deepEqual(Object.values(TABLE_FILES).sort(), [
    "src/components/Layout/Flex.tsx",
    "src/components/Layout/Grid.tsx",
    "src/components/Layout/Stack.tsx",
    "src/components/Layout/commonVariants.ts",
  ]);
  assert.equal(defaults.Main.padding, "md");
});

test("d5: ファイルの表が変われば(写しと食い違えば)読んだ表も変わる", () => {
  const changed = (rel) => readOld(rel).replace('"md": "gap-6"', '"md": "gap-5"');
  assert.notDeepEqual(loadSpacingTables(changed).tables, HAND_TABLES);
});

// ---------------------------------------------------------------- d1 全値が px を保つ

test("d1: 旧表の全値が新しい段 / 幅別 / className に写り、幅ごとの px が一致する", () => {
  let checked = 0;
  for (const [component, props] of Object.entries(COMPONENT_PROPS)) {
    for (const prop of props) {
      const table = prop in tables.common ? tables.common[prop] : tables[component][prop];
      for (const [key, classes] of Object.entries(table)) {
        const result = mapping[component][prop][key];
        assert.ok(result, `${component}.${prop}.${key} に写し先がない`);
        const before = classesToPx(classes);
        const after = resultToPx(result);
        assert.ok(before.ok && after.ok, `${component}.${prop}.${key}`);
        if (before.empty) {
          assert.equal(result.kind, "remove");
        } else {
          assert.equal(after.base, before.base, `${component}.${prop}.${key} base`);
          assert.equal(after.sm, before.sm, `${component}.${prop}.${key} sm`);
        }
        checked += 1;
      }
    }
  }
  assert.ok(checked > 100);
});

test("d1: 決まった写し方(議会の表)", () => {
  const steps = Object.fromEntries(STEPS);
  assert.deepEqual(steps, { none: 0, "2xs": 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, "2xl": 40, "3xl": 48, "4xl": 64 });
  const name = (component, prop, key) => {
    const r = mapping[component][prop][key];
    return r.kind === "step" ? r.value : r.kind === "resp" ? `${r.base}/${r.sm}` : r.kind === "class" ? `.${r.classes}` : "-";
  };
  assert.deepEqual(
    Object.keys(tables.Grid.gap).map((k) => name("Grid", "gap", k)),
    ["none", "2xs", "xs", "md", "lg", "xl", "3xl"],
  );
  assert.equal(name("Grid", "columnGap", "none"), "-");
  assert.deepEqual(
    Object.keys(tables.Flex.gap).map((k) => name("Flex", "gap", k)),
    ["none", "xs", "md", "lg", "xl", "3xl", "4xl"],
  );
  assert.deepEqual(
    Object.keys(tables.common.padding).map((k) => name("Block", "padding", k)),
    ["none", "2xs", "xs", "sm/md", "md/lg", "lg/2xl", "2xl/4xl", ".p-16 sm:p-24"],
  );
  assert.deepEqual(
    Object.keys(tables.common.margin).map((k) => name("Block", "margin", k)),
    ["none", "2xs", "xs", "md", "lg", "2xl", "4xl", ".m-24"],
  );
  assert.equal(name("Stack", "space", "6"), "lg");
  assert.equal(name("Stack", "space", "0.5"), ".gap-0.5");
  assert.equal(name("Stack", "space", "24"), ".gap-24");
});

// ---------------------------------------------------------------- d2 部品ごとの写し方

test("d2: 部品ごとの写し方(Flex gap と Grid gap は同じ名前でも写し先が違う)", () => {
  const { text } = go(tsx(`export const A = () => (<><Flex gap="sm" /><Grid gap="sm" /><Grid gap="md" /></>);`));
  assert.match(text, /<Flex gap="md" \/><Grid gap="xs" \/><Grid gap="md" \/>/);
});

test("d2: 幅別は { base, sm }、字面の文字列も {\"..\"} も", () => {
  const { text, counts } = go(tsx(`export const A = () => (<><Block padding="md" /><Section paddingBlock={"lg"} /></>);`));
  assert.match(text, /<Block padding=\{\{ base: "sm", sm: "md" \}\} \/>/);
  assert.match(text, /<Section paddingBlock=\{\{ base: "md", sm: "lg" \}\} \/>/);
  assert.equal(counts.resp, 2);
});

test("d2: Stack の space は gap へ、段に乗らない値は className(先頭)へ", () => {
  const { text, counts } = go(
    tsx(`export const A = () => (<><Stack space={4} /><Stack space={0.5} className="w-full" /><Stack space={24} /></>);`),
  );
  assert.match(text, /<Stack gap="md" \/>/);
  assert.match(text, /<Stack className="gap-0.5 w-full" \/>/);
  assert.match(text, /<Stack className="gap-24" \/>/);
  assert.equal(counts.className, 2);
});

test("d2: className が cn(...) なら先頭の引数へ、式なら一覧", () => {
  const { text, untraceable } = go(
    tsx(`export const A = ({ c }) => (<><Block padding="xxxl" className={cn("a", c)} /><Block margin="xxxl" className={c} /></>);`),
  );
  assert.match(text, /<Block className=\{cn\("p-16 sm:p-24", "a", c\)\} \/>/);
  assert.match(text, /<Block margin="xxxl" className=\{c\} \/>/);
  assert.equal(untraceable.length, 1);
  assert.match(untraceable[0].reason, /className が式/);
});

test("d2: padding が className に落ちて paddingInline が残るなら一覧(優先が変わる)", () => {
  const { text, untraceable } = go(tsx(`export const A = () => <Block padding="xxxl" paddingInline="md" />;`));
  assert.match(text, /padding="xxxl"/);
  assert.match(text, /paddingInline=\{\{ base: "sm", sm: "md" \}\}/);
  assert.match(untraceable[0].reason, /勝ってしまう/);
});

test("d2: Grid の columnGap none は prop を外し、columnGap・rowGap は gapX・gapY に名前を変える", () => {
  const { text } = go(tsx(`export const A = () => <Grid gap="md" columnGap="none" rowGap="xs" />;`));
  assert.match(text, /<Grid gap="md" gapY="2xs" \/>/);
  const both = go(tsx(`export const A = ({ c }) => <Grid columnGap={c ? "none" : "lg"} rowGap="md" />;`)).text;
  assert.match(both, /<Grid gapX=\{c \? undefined : "lg"\} gapY="md" \/>/);
  // 新しい名前は書き換え済み = 触らない
  const done = go(tsx(`export const A = () => <Grid gapX="md" gapY="2xs" />;`));
  assert.equal(done.changes.length, 0);
  assert.match(done.text, /<Grid gapX="md" gapY="2xs" \/>/);
});

test("中継部品: AppForm fieldSpace・ConfiguredFields space・UserTagList space は Stack の space、UserPage padding は Main の padding で写す(prop 名は変えない)", () => {
  const source = [
    `import { AppForm } from "@/components/Form/AppForm";`,
    `import { AppForm as F2 } from "@/components/Form";`,
    `import { ConfiguredFields } from "@/components/Form/Field";`,
    `import { UserTagList } from "@/features/userTag/components/common/UserTagList";`,
    `import { UserPage } from "@/app/(user)/_layout/UserPage";`,
    `export const A = ({ c }) => (<UserPage padding="lg"><AppForm fieldSpace={6} /><F2 fieldSpace={c ? 4 : 2} /><ConfiguredFields space={8} />` +
      `<UserTagList space={1} /></UserPage>);`,
  ].join("\n");
  const { text, untraceable } = go(source, { fileRel: "src/app/x/A.tsx" });
  assert.deepEqual(untraceable, []);
  assert.match(text, /<UserPage padding=\{\{ base: "md", sm: "lg" \}\}>/);
  assert.match(text, /<AppForm fieldSpace="lg" \/>/);
  assert.match(text, /<F2 fieldSpace=\{c \? "md" : "xs"\} \/>/);
  assert.match(text, /<ConfiguredFields space="xl" \/>/);
  assert.match(text, /<UserTagList space="2xs" \/>/);
  // 2 回目(書き換え前と照らす)は 0 件、段の名前は書き換え済み
  const again = go(text, { fileRel: "src/app/x/A.tsx", baseSource: source });
  assert.equal(again.text, text);
  assert.equal(again.changes.length, 0);
});

test("中継部品: 段に乗らない値は className に落とさず一覧(className は中の部品に届かない)", () => {
  const source = [
    `import { AppForm } from "@/components/Form/AppForm";`,
    `import { ConfiguredFields } from "@/components/Form/Field/Configured";`,
    `export const A = () => (<><AppForm fieldSpace={5} className="x" /><ConfiguredFields space={0.5} /></>);`,
  ].join("\n");
  const { text, untraceable } = go(source, { fileRel: "src/app/x/A.tsx" });
  assert.equal(text, source);
  assert.deepEqual(
    untraceable.map((e) => [e.component, e.prop, /中継の prop の値が段に乗らない/.test(e.reason)]),
    [
      ["AppForm", "fieldSpace", true],
      ["ConfiguredFields", "space", true],
    ],
  );
});

test("中継部品: 同じ名前のほかの部品は触らない", () => {
  const source = [`import { AppForm } from "@/lib/other";`, `export const A = () => <AppForm fieldSpace={6} />;`].join("\n");
  assert.equal(go(source, { fileRel: "src/app/x/A.tsx" }).text, source);
});

test("d2: 同じファイルの const(オブジェクトの中も)を定義の側で写す", () => {
  const { text, untraceable } = go(
    tsx(`const GAP = 6;\nconst PAD = { card: "lg", tight: "sm" } as const;\nexport const A = () => (<Stack space={GAP}><Block padding={PAD.card} /><Block padding={PAD.tight} /></Stack>);`),
  );
  assert.match(text, /const GAP = "lg";/);
  assert.match(text, /const PAD = \{ card: \{ base: "md", sm: "lg" \}, tight: "xs" \} as const;/);
  assert.match(text, /<Stack gap=\{GAP\}>/);
  assert.deepEqual(untraceable, []);
});

test("d2: 三項・?? の枝を写す。追えない枝は一覧", () => {
  const { text, untraceable } = go(
    tsx(`export const A = ({ dense, padding }) => (<><Flex gap={dense ? "xs" : "md"} /><Block padding={padding ?? "sm"} /><Stack space={dense ? 2 : 6} /></>);`),
  );
  assert.match(text, /<Flex gap=\{dense \? "xs" : "lg"\} \/>/);
  assert.match(text, /<Block padding=\{padding \?\? "xs"\} \/>/);
  assert.match(text, /<Stack gap=\{dense \? "xs" : "lg"\} \/>/);
  assert.deepEqual(
    untraceable.map((e) => [e.prop, e.reason]),
    [["padding", "中継 wrapper の prop"]],
  );
});

test("d2: 定数がほかでも使われる・className に落ちる・三項の枝が className なら書かずに一覧", () => {
  const { text, untraceable } = go(
    tsx(`const G = 2;\nconst H = 0.5;\nconsole.log(G);\nexport const A = ({ c }) => (<><Stack space={G} /><Stack space={H} /><Stack space={c ? 4 : 0.5} /></>);`),
  );
  assert.match(text, /const G = 2;/);
  assert.match(text, /const H = 0.5;/);
  assert.match(text, /<Stack space=\{c \? 4 : 0.5\} \/>/);
  const reasons = untraceable.map((e) => e.reason).join("\n");
  assert.match(reasons, /定数がほかの所でも使われている/);
  assert.match(reasons, /定数の値が段に乗らない/);
  assert.match(reasons, /三項・\?\? の枝が段に乗らない/);
});

test("d2: import 元で部品を特定する(別名・個別のパス・相対・TextBlocks の Main)。ほかの同名部品は触らない", () => {
  const source = [
    `import { Stack as S } from "@/components/Layout/Stack";`,
    `import { Flex } from "../../components/Layout";`,
    `import { Main } from "@/components/TextBlocks";`,
    `import { Grid } from "@/lib/other";`,
    `export const A = () => (<Main padding="sm"><S space={2} /><Flex gap="xs" /><Grid gap="sm" /></Main>);`,
  ].join("\n");
  const { text } = go(source, { fileRel: "src/app/x/A.tsx" });
  assert.match(text, /<Main padding="xs"><S gap="xs" \/><Flex gap="xs" \/><Grid gap="sm" \/><\/Main>/);
});

test("d2: 今の main にある import の形を全部見分ける(barrel・個別のパス・相対の個別・TextBlocks の Main)", () => {
  // 今の main の src の import の形: @/components/Layout・@/components/Layout/<部品>・../Layout/<部品>・@/components/TextBlocks
  const source = [
    `import { Block } from "@/components/Layout";`,
    `import { Section } from "@/components/Layout/Section";`,
    `import { Main } from "../Layout/Main";`,
    `import { Main as TM } from "@/components/TextBlocks";`,
    `import { Para } from "@/components/TextBlocks/Para";`,
    `export const A = () => (<><Block padding="xs" /><Section margin="xs" /><Main padding="sm" /><TM padding="sm" /><Para /></>);`,
  ].join("\n");
  const { text } = go(source, { fileRel: "src/components/X/A.tsx" });
  assert.match(text, /<Block padding="2xs" \/><Section margin="2xs" \/><Main padding="xs" \/><TM padding="xs" \/><Para \/>/);
});

test("d2: 既定値で余白が付く所(Main の padding md)を別に出す", () => {
  const { defaults: found, counts } = go(tsx(`export const A = () => (<><Main>x</Main><Main padding="none">y</Main></>);`));
  assert.equal(counts.defaults, 1);
  assert.deepEqual(
    found.map((e) => [e.component, e.prop, e.default, e.px]),
    [["Main", "padding", "md", "12→16"]],
  );
});

// ---------------------------------------------------------------- d3 冪等

const SAMPLE = tsx(
  [
    `const GAP = 6;`,
    `export const A = ({ dense, padding }) => (`,
    `  <Main padding="md">`,
    `    <Stack space={GAP}><Stack space={0.5} /><Stack space={dense ? 2 : 4} /></Stack>`,
    `    <Flex gap="sm" padding={padding ?? "lg"} />`,
    `    <Grid gap="xs" columnGap="none" rowGap="sm" />`,
    `    <Block padding="xxxl" margin="xl" className="w-full" />`,
    `  </Main>`,
    `);`,
  ].join("\n"),
);

test("d3: 書き換え前の版と照らすので、2 回目は 0 件の変更", () => {
  const first = go(SAMPLE, { baseSource: SAMPLE });
  assert.notEqual(first.text, SAMPLE);
  const second = go(first.text, { baseSource: SAMPLE });
  assert.equal(second.text, first.text);
  assert.equal(second.changes.length, 0);
  assert.deepEqual(second.untraceable, first.untraceable);
});

test("d3: 照らす版が無いと重なる名前を二重に写す(だから --base が要る)", () => {
  const first = go(SAMPLE, { baseSource: SAMPLE });
  const unsafe = go(first.text);
  assert.notEqual(unsafe.text, first.text);
});

test("d3: 書き換え前と食い違う値(写した後でもない)は一覧", () => {
  const changed = SAMPLE.replace('<Flex gap="sm"', '<Flex gap="xl"');
  const { untraceable } = go(changed, { baseSource: SAMPLE });
  assert.ok(untraceable.some((e) => e.component === "Flex" && /食い違う/.test(e.reason)));
});

test("d3: run をリポで 2 回(dry-run → apply → apply、同じ base)、2 回目は 0 ファイル", () => {
  const root = mkdtempSync(join(tmpdir(), "spacing-scale-"));
  try {
    for (const [rel, text] of Object.entries(OLD_SOURCES)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    }
    mkdirSync(join(root, "src/app"), { recursive: true });
    writeFileSync(join(root, "src/app/A.tsx"), SAMPLE);
    const gitIn = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
    gitIn("init", "-q");
    gitIn("add", ".");
    gitIn("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");

    const dry = run(root);
    assert.equal(dry.counts.files, 1);
    assert.equal(readFileSync(join(root, "src/app/A.tsx"), "utf8"), SAMPLE);
    const written = run(root, { base: "HEAD", write: true });
    assert.deepEqual(written.changes, dry.changes);
    const after = readFileSync(join(root, "src/app/A.tsx"), "utf8");
    assert.notEqual(after, SAMPLE);
    const again = run(root, { base: "HEAD", write: true });
    assert.throws(() => run(root, { write: true }), /base/);
    assert.throws(() => run(root, { base: null, write: true }), /base/);
    assert.equal(again.counts.files, 0);
    assert.equal(again.changes.length, 0);
    assert.equal(readFileSync(join(root, "src/app/A.tsx"), "utf8"), after);

    // コミットした後も、書き換え前のコミットを --base に渡せば 0 件
    gitIn("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "migrated");
    assert.equal(run(root, { base: "HEAD~1" }).counts.files, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- d4 追えない所の一覧

test("d4: 追えない所(中継 wrapper・別ファイルの定数・spread・式)が file:line で出て、何度走らせても同じ", () => {
  const source = [
    `import { Block, Stack } from "@/components/Layout";`,
    `import { SPACE } from "./constants";`,
    `export const Card = ({ padding, ...props }) => <Block padding={padding} {...props} />;`,
    `export const B = ({ n }) => (<><Stack space={SPACE} /><Stack space={n * 2} /><Block padding={\`md\`} /></>);`,
  ].join("\n");
  const first = go(source, { fileRel: "src/app/B.tsx" });
  const runs = [first, go(source, { fileRel: "src/app/B.tsx" }), go(source, { fileRel: "src/app/B.tsx" })];
  for (const result of runs) assert.deepEqual(result.untraceable, first.untraceable);
  assert.deepEqual(
    first.untraceable.map((e) => `${e.file}:${e.line} ${e.component} ${e.prop} ${e.reason}`),
    [
      "src/app/B.tsx:3 Block padding 中継 wrapper の prop",
      "src/app/B.tsx:3 Block * spread(余白 prop が入りうる)",
      "src/app/B.tsx:4 Stack space 別ファイルの定数",
      "src/app/B.tsx:4 Stack space 式",
    ],
  );
  assert.match(first.text, /<Block padding=\{\{ base: "sm", sm: "md" \}\} \/>/);
});

// ---------------------------------------------------------------- 引数(D38: --apply は --base 必須)

test("引数: --apply は --base <ref> を要し、--no-base・--write では書かない", () => {
  assert.match(parseArgs(["--apply"], "/r").error, /--base/);
  assert.match(parseArgs(["--apply", "--no-base"], "/r").error, /--base/);
  assert.match(parseArgs(["--apply", "--no-base", "--base", "abc"], "/r").error, /--no-base/);
  assert.match(parseArgs(["--apply", "--base"], "/r").error, /--base/);
  assert.match(parseArgs(["--apply", "--base", "--json", "x"], "/r").error, /--base/);
  assert.match(parseArgs(["--write", "--base", "abc"], "/r").error, /--apply/);
  assert.deepEqual(parseArgs(["--apply", "--base", "abc"], "/r"), { root: "/r", base: "abc", write: true, json: undefined });
  assert.deepEqual(parseArgs([], "/r"), { root: "/r", base: "HEAD", write: false, json: undefined });
  assert.deepEqual(parseArgs(["--no-base", "--root", "/x"], "/r"), { root: "/x", base: null, write: false, json: undefined });
});

// ---------------------------------------------------------------- 文書の対応表

test("Layout の README の「旧名 → 新名」の表は codemod の対応表と一致する(手で直さない)", () => {
  const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/components/Layout/README.md"), "utf8");
  const [start, end] = README_TABLE_MARKS;
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  assert.ok(from >= 0 && to > from, "README に対応表の印が無い");
  assert.equal(readme.slice(from + start.length, to).trim(), formatMappingTable(mapping));
});

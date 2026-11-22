// .notices/20261122-134000-messaging-records.codemod.test.mjs
// 実行: pnpm test .notices
// 小さな木(上流は取り込んだ後 = 新しい名前、fork のファイルは古い名前)で: 改名(import・参照・別名・shorthand)・member・
// 受け口の項目の移しと宣言の改名・指定子の書き直し・止まる一覧・語・2 回目は同じ・引数の誤りは exit 2

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { VOCAB, parseArgs, run, validateVocab } from "./20261122-134000-messaging-records.codemod.mjs";

const TOOL = fileURLToPath(new URL("./20261122-134000-messaging-records.codemod.mjs", import.meta.url));

const UPSTREAM = {
  "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, target: "ES2020", module: "esnext", moduleResolution: "bundler", jsx: "preserve", paths: { "@/*": ["./src/*"] } } }),
  "src/jsx.d.ts": "declare namespace JSX { interface Element {} interface IntrinsicElements { [name: string]: unknown } }\n",
  "src/lib/messaging/index.ts": `export * from "./vars";\n`,
  "src/lib/messaging/vars/index.ts": [
    "export type MessageVarDeclaration = { key: string };",
    "export const varCatalog = (): string[] => [];",
    "export const varTextOf = (d: MessageVarDeclaration): string => d.key;",
    "export const findVar = (): string[] => [];",
    "export const VAR_KEY_PATTERN = /^[a-z]+$/;",
    "",
  ].join("\n"),
  "src/features/core/messaging/services/server/admin/types.ts":
    "export type MessageRecordTarget = { key: string; resolveRecipients: (ids: readonly string[]) => Promise<string[]> };\n",
  "src/features/core/messaging/hooks/index.ts": [
    "export type MessageTemplate = { id: string; vars: string[] };",
    "export function useTemplate(): MessageTemplate { return { id: \"t\", vars: [] }; }",
    "export function VarTags(props: { vars: string[] }): JSX.Element { return props as unknown as JSX.Element; }",
    "",
  ].join("\n"),
};

const FORK = {
  "src/features/shop/util.ts": "export const util = 1;\n",
  "src/features/shop/useThing.tsx": [
    `import { MessageEmbeddedDeclaration, embeddedCatalog as cat, EMBEDDED_KEY_PATTERN } from "@/lib/messaging";`,
    `import { useTemplate, VarTags } from "@/features/core/messaging/hooks";`,
    `import type { MessageSystemTemplate } from "@/features/core/messaging/services/server/sendMessage";`,
    "",
    "// テンプレートの種類と経路",
    "export function useThing(d: MessageEmbeddedDeclaration) {",
    "  const t = useTemplate();",
    "  const { embedded } = t;",
    "  const list: MessageEmbeddedDeclaration[] = [d];",
    "  const mine = { embedded: 1 };",
    "  const tag = <VarTags embedded={t.embedded} />;",
    "  return { list, cat, EMBEDDED_KEY_PATTERN, a: t.embedded, b: t[\"embedded\"], embedded, mine, tag, n: (t as any).embedded };",
    "}",
    "export type Old = MessageSystemTemplate;",
    "",
  ].join("\n"),
  "src/features/core/messaging/bulkSendTargets/orders.ts": [
    `import type { MessageBulkSendTarget } from "@/features/core/messaging/services/server/admin/types";`,
    `import { util } from "../../../shop/util";`,
    "",
    "// 一括送信の対象",
    "export const bulkSendTarget: MessageBulkSendTarget = {",
    "  key: `orders${util}`,",
    "  async resolveUserIds(ids) {",
    "    return [...ids];",
    "  },",
    "};",
    "",
  ].join("\n"),
  "src/features/core/messaging/bulkSendTargets/other.ts": "export const bulkSendTarget = { key: \"other\" };\n",
  "src/features/shop/uses.ts": `import { bulkSendTarget } from "@/features/core/messaging/bulkSendTargets/orders";\nexport const k = bulkSendTarget.key;\n`,
  "src/features/shop/ns.ts": [
    `import * as m from "@/lib/messaging";`,
    `export { embeddedTextOf } from "@/lib/messaging";`,
    "export const c = m.embeddedCatalog;",
    "",
  ].join("\n"),
  "src/features/shop/taken.ts": `import { findEmbedded } from "@/lib/messaging";\nconst findVar = 1;\nexport const z = [findEmbedded, findVar];\n`,
};

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), "messaging-records-"));
  for (const [rel, text] of Object.entries({ ...UPSTREAM, ...FORK })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const read = (root, rel) => readFileSync(join(root, rel), "utf8");
const reasons = (result, reason) => result.stopped.filter((s) => s.reason === reason);

test("対応表: 形が正しく、指令の行がそろう", () => {
  validateVocab(VOCAB);
  const has = (kind, old, next, order) => VOCAB.some((r) => r.kind === kind && r.old === old && r.new === next && r.order === order);
  assert.ok(has("code-name", "MessageEmbeddedDeclaration", "MessageVarDeclaration", "S1"));
  assert.ok(has("code-name", "embedded", "vars", "S1"));
  assert.ok(has("code-name", "MessageEmbeddedName", "MessageNamedVar", "S1"));
  assert.ok(has("code-name", "SendEmbeddedInputs", "SendVarInputs", "S1"));
  assert.ok(has("path", "src/lib/messaging/embedded", "src/lib/messaging/vars", "S1"));
  assert.ok(has("code-name", "embedded_values", "vars", "S2"));
  assert.ok(VOCAB.some((r) => r.kind === "word" && r.old === "system_template" && r.new === null && r.order === "S2"));
  assert.ok(has("code-name", "MessageSystemTemplate", null, "S2"));
  assert.ok(has("code-name", "MessageBulkSendTarget", "MessageRecordTarget", "S3"));
  assert.ok(has("code-name", "resolveUserIds", "resolveRecipients", "S3"));
  assert.ok(has("path", "src/features/core/messaging/bulkSendTargets", "src/features/{owner}/recordTargets", "S3"));
  for (const w of ["種類", "回", "経路", "ひな形", "管理画面での文面の直し"]) assert.ok(VOCAB.some((r) => r.kind === "word" && r.old === w), w);
  assert.throws(() => validateVocab([{ kind: "code-name", as: "export", old: "a", new: "a", order: "S1", note: "", from: ["src"] }]));
  assert.throws(() => validateVocab([{ kind: "word", old: "x", new: "y", order: "S9", note: "", match: "x" }]));
});

test("dry-run は書かず、--apply で書き換える。2 回目は何も変えない", () => {
  const root = makeTree();
  try {
    const dry = run(root, { owners: { orders: "shop" }, upstreamRev: null });
    assert.equal(read(root, "src/features/shop/useThing.tsx"), FORK["src/features/shop/useThing.tsx"]);
    assert.ok(existsSync(join(root, "src/features/core/messaging/bulkSendTargets/orders.ts")));

    const result = run(root, { apply: true, owners: { orders: "shop" }, upstreamRev: null });
    assert.deepEqual(result.changed, dry.changed);

    // export の改名: import・型の位置・別名・shorthand
    const thing = read(root, "src/features/shop/useThing.tsx");
    assert.match(thing, /import \{ MessageVarDeclaration, varCatalog as cat, VAR_KEY_PATTERN \} from "@\/lib\/messaging";/);
    assert.match(thing, /useThing\(d: MessageVarDeclaration\)/);
    assert.match(thing, /const list: MessageVarDeclaration\[\]/);
    assert.match(thing, /EMBEDDED_KEY_PATTERN: VAR_KEY_PATTERN/);
    // member: 上流の型の受け手だけ。fork の object・any の受け手はそのまま
    assert.match(thing, /const \{ vars: embedded \} = t;/);
    assert.match(thing, /a: t\.vars, b: t\["vars"\]/);
    assert.match(thing, /<VarTags vars=\{t\.vars\} \/>/);
    assert.match(thing, /const mine = \{ embedded: 1 \};/);
    assert.match(thing, /\(t as any\)\.embedded/);

    // path: 受け口の項目を持ち主のドメインへ、宣言・型・member の改名、相対の指定子の引き直し
    assert.ok(!existsSync(join(root, "src/features/core/messaging/bulkSendTargets/orders.ts")));
    const moved = read(root, "src/features/shop/recordTargets/orders.ts");
    assert.match(moved, /import type \{ MessageRecordTarget \} from "@\/features\/core\/messaging\/services\/server\/admin\/types";/);
    assert.match(moved, /import \{ util \} from "\.\.\/util";/);
    assert.match(moved, /export const recordTarget: MessageRecordTarget = \{/);
    assert.match(moved, /async resolveRecipients\(ids\)/);
    assert.match(read(root, "src/features/shop/uses.ts"), /from "@\/features\/shop\/recordTargets\/orders"/);
    assert.deepEqual(result.moved, [{ from: "src/features/core/messaging/bulkSendTargets/orders.ts", to: "src/features/shop/recordTargets/orders.ts", order: "S3" }]);

    // 止まる一覧
    assert.deepEqual(reasons(result, "ownerUnknown").map((s) => s.file), ["src/features/core/messaging/bulkSendTargets/other.ts"]);
    assert.deepEqual(reasons(result, "removed").map((s) => s.old), ["MessageSystemTemplate"]);
    assert.deepEqual(reasons(result, "namespace").map((s) => `${s.file}:${s.old}`), ["src/features/shop/ns.ts:embeddedCatalog"]);
    assert.deepEqual(reasons(result, "reexport").map((s) => s.old), ["embeddedTextOf"]);
    assert.deepEqual(reasons(result, "nameTaken").map((s) => `${s.file}:${s.old}`), ["src/features/shop/taken.ts:findEmbedded"]);
    assert.deepEqual(reasons(result, "untyped").map((s) => `${s.file}:${s.old}`), ["src/features/shop/useThing.tsx:embedded"]);
    assert.deepEqual(reasons(result, "handStep").map((s) => s.old), ["resolveUserIds"]);
    assert.match(read(root, "src/features/shop/taken.ts"), /import \{ findEmbedded \}/);

    // 語: 上流を読むファイル・受け口の項目の注釈だけ、書き換えない
    const words = reasons(result, "word").map((s) => `${s.file}:${s.line}:${s.old}`);
    assert.deepEqual(words, [
      "src/features/shop/recordTargets/orders.ts:4:一括送信の対象",
      "src/features/shop/useThing.tsx:5:種類",
      "src/features/shop/useThing.tsx:5:経路",
    ]);
    assert.match(thing, /\/\/ テンプレートの種類と経路/);

    const again = run(root, { apply: true, owners: { orders: "shop" }, upstreamRev: null });
    assert.deepEqual(again.changed, []);
    assert.deepEqual(again.renamed, []);
    assert.deepEqual(again.moved, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("引数: 誤りは exit 2、--owner は <名前>=<ドメイン>", () => {
  assert.deepEqual(parseArgs(["--apply", "--owner", "orders=shop", "--json"]), { apply: true, json: true, owners: { orders: "shop" }, upstreamRev: undefined });
  assert.throws(() => parseArgs(["--owner", "orders"]));
  assert.throws(() => parseArgs(["--owner"]));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, [TOOL, "--nope"], { encoding: "utf8", env, cwd: tmpdir() });
  assert.equal(child.status, 2);
});

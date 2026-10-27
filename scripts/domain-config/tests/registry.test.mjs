// dc:generate のレジストリ更新（domainEntry.ts の生成 / schemaRegistry / domainConfigRegistry / objectEntry）の回帰テスト。
// serviceRegistry.ts 自体の生成・検査は scripts/registry/serviceRegistry/serviceRegistry.test.mjs（pnpm test:service-registry）。
// 実行: pnpm test:dc-registry
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeObjectEntry, scanObjectEntries, upsertObjectEntry } from "../text/objectEntry.mjs";
import { ACCESS_PRESETS, PRESET_RULES, serializeAccess, serializeRule } from "../render/registry/presetAccess.mjs";
import { buildDomainEntryAccess, renderDomainEntry, renderDomainEntryOutput } from "../render/registry/domainEntry.mjs";
import { renderDomainConfigRegistryPatch, renderSchemaRegistryPatch } from "../render/registry/lineRegistries.mjs";
import { domainTableName } from "../domain/names.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { createDomainContext } from "../domain/context.mjs";
import { applyOutputs } from "../pipeline/apply.mjs";

const SERVICE_REGISTRY = `import { userService } from "@/features/core/user/services/server/userService";
import { sampleService } from "@/features/sample/services/server/sampleService";

export const serviceRegistry: Record<string, DomainRegistryEntry> = {
  user: { service: userService, access: ADMIN_ONLY },

  // --- AUTO-GENERATED-START ---
  sample: {
    service: sampleService,
    access: {
      read: "public",
      write: { roleCategories: ["admin"] },
    },
  },
  // --- AUTO-GENERATED-END ---

};
`;

const tempRoots = [];
after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dc-registry-"));
  tempRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const silent = { log: () => {}, warn: () => {} };

/** domainEntry.ts を書く（警告の件数を返す） */
function writeDomainEntry(root, camel) {
  const workspace = createWorkspace(root);
  const warnings = [];
  applyOutputs([renderDomainEntryOutput(createDomainContext(workspace, camel), (m) => warnings.push(m))], silent);
  return warnings.length;
}

const API_ACCESS = { read: "public", write: { roleCategories: ["admin"] } };

test("scanObjectEntries: 直下のキーだけを拾い、入れ子のキーは拾わない", () => {
  const { entries } = scanObjectEntries(SERVICE_REGISTRY, "serviceRegistry");
  assert.deepEqual(entries.map((e) => e.key), ["user", "sample"]);
});

test("upsertObjectEntry: 複数行エントリを丸ごと置換する", () => {
  const out = upsertObjectEntry(SERVICE_REGISTRY, { objectName: "serviceRegistry", key: "sample", value: "X" });
  assert.match(out, /\n  sample: X,\n  \/\/ --- AUTO-GENERATED-END ---/);
  assert.doesNotMatch(out, /service: sampleService/);
  assert.match(out, /user: \{ service: userService, access: ADMIN_ONLY \},/);
});

test("upsertObjectEntry: 無ければ AUTO-GENERATED-END の直前に追加する", () => {
  const out = upsertObjectEntry(SERVICE_REGISTRY, { objectName: "serviceRegistry", key: "newDomain", value: "Y" });
  assert.match(out, /  newDomain: Y,\n  \/\/ --- AUTO-GENERATED-END ---/);
});

test("upsertObjectEntry: ブロック外の直下エントリも置換する（旧フォーク互換）、同名の入れ子キーには触れない", () => {
  const text = `export const serviceRegistry = {
  legacy: { service: legacyService, access: { read: "public" } },
  other: { service: otherService, access: { legacy: "x" } },
  // --- AUTO-GENERATED-START ---
  // --- AUTO-GENERATED-END ---
};
`;
  const out = upsertObjectEntry(text, { objectName: "serviceRegistry", key: "legacy", value: "Z" });
  assert.match(out, /^  legacy: Z,$/m);
  assert.match(out, /access: \{ legacy: "x" \}/);
  assert.equal(out.match(/legacy: Z/g).length, 1);
});

test("upsertObjectEntry: クォート付きキー・末尾カンマ無し・マーカー無しでも扱える", () => {
  const text = `export const serviceRegistry = {
  "a": 1,
  b: 2
};
`;
  assert.match(upsertObjectEntry(text, { objectName: "serviceRegistry", key: "b", value: "3" }), /^  b: 3,$/m);
  assert.match(upsertObjectEntry(text, { objectName: "serviceRegistry", key: "c", value: "4" }), /  b: 2,\n  c: 4,\n\};/);
  assert.match(upsertObjectEntry(text, { objectName: "serviceRegistry", key: "a", value: "5" }), /^  a: 5,$/m);
});

test("removeObjectEntry: 複数行エントリを行ごと丸ごと削除する", () => {
  const { text, removed } = removeObjectEntry(SERVICE_REGISTRY, { objectName: "serviceRegistry", key: "sample" });
  assert.equal(removed, true);
  assert.match(text, /\/\/ --- AUTO-GENERATED-START ---\n  \/\/ --- AUTO-GENERATED-END ---/);
  assert.match(text, /user: \{ service: userService, access: ADMIN_ONLY \},/);
});

test("removeObjectEntry: キー完全一致のみ（tag を消しても user_tag は残る）", () => {
  const map = `export const domainConfigMap = {
  user_tag: userTagConfig,
  // --- AUTO-GENERATED-START ---
  tag: tagConfig,
  my_tag: myTagConfig,
  // --- AUTO-GENERATED-END ---
} as const;
`;
  const { text } = removeObjectEntry(map, { objectName: "domainConfigMap", key: "tag" });
  assert.equal(text, map.replace("  tag: tagConfig,\n", ""));
});

test("removeObjectEntry: 無いキーは何も変えない・末尾カンマ無しの最後のエントリも消せる", () => {
  const text = `export const serviceRegistry = {
  a: 1,
  b: 2
};
`;
  assert.deepEqual(removeObjectEntry(text, { objectName: "serviceRegistry", key: "zz" }), { text, removed: false });
  assert.equal(removeObjectEntry(text, { objectName: "serviceRegistry", key: "b" }).text, "export const serviceRegistry = {\n  a: 1,\n};\n");
});

test("presetAccess: プリセットの写しが domain-api-access.config.ts と一致する", async () => {
  const { tsImport } = await import("tsx/esm/api");
  const config = await tsImport(path.resolve(import.meta.dirname, "../../../src/config/app/domain-api-access.config.ts"), import.meta.url);
  for (const [name, value] of Object.entries({ ...ACCESS_PRESETS, ...PRESET_RULES })) {
    assert.deepEqual(value, config[name], `${name} が TS 側と食い違っています`);
  }
});

test("schemaRegistry: 引用符違いの既存 export を登録済みとみなす", () => {
  const original = `// --- AUTO-GENERATED-START ---
export * from '@/features/sample/entities/drizzle';
// --- AUTO-GENERATED-END ---
`;
  const root = makeRoot({ "src/registry/schemaRegistry.ts": original });
  applyOutputs([renderSchemaRegistryPatch(createWorkspace(root), { camel: "sample", dbEngine: "Neon" })], silent);
  assert.equal(read(root, "src/registry/schemaRegistry.ts"), original);
});

test("domainConfigRegistry: 引用符・空白違いの既存 import / エントリを登録済みとみなす", () => {
  const original = `import sampleCategoryConfig from '@/features/sampleCategory/domain.json';

export const domainConfigRegistry = {
  // --- AUTO-GENERATED-START ---
  "sample_category":   sampleCategoryConfig,
  // --- AUTO-GENERATED-END ---
} as const;
`;
  const root = makeRoot({ "src/registry/domainConfigRegistry.ts": original });
  const logs = [];
  applyOutputs([renderDomainConfigRegistryPatch(createWorkspace(root), { camel: "sampleCategory" })], { log: (m) => logs.push(m), warn: () => {} });
  assert.equal(read(root, "src/registry/domainConfigRegistry.ts"), original);
  assert.match(logs.join("\n"), /^スキップしました（既に存在）: /);
  // 片方だけ無ければ足して「更新しました」
  const root2 = makeRoot({ "src/registry/domainConfigRegistry.ts": original.replace("import sampleCategoryConfig from '@/features/sampleCategory/domain.json';\n", "") });
  const logs2 = [];
  applyOutputs([renderDomainConfigRegistryPatch(createWorkspace(root2), { camel: "sampleCategory" })], { log: (m) => logs2.push(m), warn: () => {} });
  assert.match(read(root2, "src/registry/domainConfigRegistry.ts"), /^import sampleCategoryConfig from "@\/features\/sampleCategory\/domain\.json";/m);
  assert.match(logs2.join("\n"), /^更新しました: /);
});

test("serializeRule / serializeAccess: 単一ルールは名前、read/write がプリセットなら spread、operations は 1 行ずつ", () => {
  assert.equal(serializeRule({ roleCategories: ["admin"] }), "ADMIN_RULE");
  assert.equal(serializeRule("none"), '"none"');
  assert.equal(serializeRule({ roles: ["editor"] }), '{"roles":["editor"]}');
  const { lines, names } = serializeAccess({
    write: { roleCategories: ["admin"] },
    read: "public",
    operations: { update: "authenticated", truncateAll: { roleCategories: ["admin"] } },
  });
  assert.deepEqual(lines, ["...PUBLIC_READ,", "operations: {", '  update: "authenticated",', "  truncateAll: ADMIN_RULE,", "},"]);
  assert.deepEqual(names.sort(), ["ADMIN_RULE", "PUBLIC_READ"]);
  const custom = serializeAccess({ read: "authenticated", write: { roles: ["editor"] } });
  assert.deepEqual(custom.lines, ['read: "authenticated",', 'write: {"roles":["editor"]},']);
  assert.deepEqual(custom.names, []);
});

test("buildDomainEntryAccess: apiAccess 未宣言は ADMIN_ONLY、truncateAll は管理者、export/import は useImportExport が偽なら none", () => {
  assert.deepEqual(buildDomainEntryAccess(null), {
    ...ACCESS_PRESETS.ADMIN_ONLY,
    operations: { truncateAll: PRESET_RULES.ADMIN_RULE, export: PRESET_RULES.ADMIN_RULE, import: PRESET_RULES.ADMIN_RULE },
  });
  const closed = buildDomainEntryAccess({ apiAccess: API_ACCESS, useImportExport: false });
  assert.deepEqual(closed.operations, { truncateAll: PRESET_RULES.ADMIN_RULE, export: "none", import: "none" });
  const withOps = buildDomainEntryAccess({ apiAccess: { ...API_ACCESS, operations: { update: "authenticated" } }, useImportExport: true });
  assert.equal(withOps.operations.update, "authenticated");
  assert.deepEqual(withOps.operations.export, PRESET_RULES.ADMIN_RULE);
});

test("renderDomainEntry: 遅延 import のキー付きオブジェクトと、使うプリセットだけの import 行", () => {
  const text = renderDomainEntry({ camel: "sample", config: { apiAccess: API_ACCESS, useImportExport: false } });
  assert.match(text, /^import type \{ DomainEntries \} from "@\/lib\/domain\/types";$/m);
  assert.match(text, /^import \{ ADMIN_RULE, PUBLIC_READ \} from "@\/config\/app\/domain-api-access\.config";$/m);
  assert.match(text, /service: \(\) => import\("\.\/sampleService"\)\.then\(\(m\) => m\.sampleService\),/);
  assert.match(text, /\.\.\.PUBLIC_READ,\n\s+operations: \{\n\s+truncateAll: ADMIN_RULE,\n\s+export: "none",\n\s+import: "none",/);
  assert.match(text, /\} satisfies DomainEntries;\n$/);
  // 静的 import は許可された 2 モジュールだけ（registry:check が縛る契約）
  const imports = [...text.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["@/lib/domain/types", "@/config/app/domain-api-access.config"]);
});

test("renderDomainEntry: table / idColumn を service の直後に書く（表名は plural、無ければ snake_case。Firestore は null）", () => {
  const withPlural = renderDomainEntry({ camel: "sampleCategory", config: { apiAccess: API_ACCESS, plural: "sample_categories", dbEngine: "Neon" } });
  assert.match(
    withPlural,
    /service: \(\) => import\("\.\/sampleCategoryService"\)\.then\(\(m\) => m\.sampleCategoryService\),\n\s+table: "sample_categories",\n\s+idColumn: "id",\n\s+access: \{/,
  );
  assert.match(renderDomainEntry({ camel: "blogPost", config: { apiAccess: API_ACCESS, plural: "blogPosts" } }), /table: "blog_posts",/);
  assert.match(renderDomainEntry({ camel: "blogPost", config: { apiAccess: API_ACCESS } }), /table: "blog_post",/);
  assert.match(renderDomainEntry({ camel: "blogPost", config: null }), /table: "blog_post",\n\s+idColumn: "id",/);
  const firestore = renderDomainEntry({ camel: "chatLog", config: { apiAccess: API_ACCESS, dbEngine: "Firestore" } });
  assert.match(firestore, /table: null,\n\s+idColumn: null,/);
  assert.doesNotMatch(firestore, /table: "/);
});

test("domainTableName: 表の定義の生成器と同じ式（plural 優先、snake_case）", () => {
  assert.equal(domainTableName("sample", { plural: "samples" }), "samples");
  assert.equal(domainTableName("sampleTag", { plural: "sample_tags" }), "sample_tags");
  assert.equal(domainTableName("sampleTag", {}), "sample_tag");
  assert.equal(domainTableName("sample_tag", null), "sample_tag");
});

test("domainEntry: domain.json から services/server/domainEntry.ts を書き、再実行で差分なし。apiAccess 未宣言は警告", () => {
  const root = makeRoot({
    "src/features/sample/domain.json": JSON.stringify({ apiAccess: API_ACCESS, useImportExport: true }),
    "src/features/save/domain.json": JSON.stringify({}),
  });
  assert.equal(writeDomainEntry(root, "sample"), 0);
  const first = read(root, "src/features/sample/services/server/domainEntry.ts");
  assert.equal(first, renderDomainEntry({ camel: "sample", config: { apiAccess: API_ACCESS, useImportExport: true } }));
  assert.equal(writeDomainEntry(root, "sample"), 0);
  assert.equal(read(root, "src/features/sample/services/server/domainEntry.ts"), first);
  assert.equal(writeDomainEntry(root, "save"), 1);
  assert.match(read(root, "src/features/save/services/server/domainEntry.ts"), /\.\.\.ADMIN_ONLY,/);
});

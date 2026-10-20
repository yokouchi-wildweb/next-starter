// dc:generate のレジストリ更新（serviceRegistry / schemaRegistry / domainConfigRegistry）の回帰テスト。
// 実行: pnpm test:dc-registry
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeObjectEntry, scanObjectEntries, upsertObjectEntry } from "./utils/objectEntry.mjs";
import updateServiceRegistry from "./updateServiceRegistry.mjs";
import updateSchemaRegistry from "./updateSchemaRegistry.mjs";
import updateDomainConfigRegistry from "./updateDomainConfigRegistry.mjs";

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

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const API_ACCESS = { read: "public", write: { roleCategories: ["admin"] } };

test("scanObjectEntries: 直下のキーだけを拾い、入れ子のキーは拾わない", () => {
  const { entries } = scanObjectEntries(SERVICE_REGISTRY, "serviceRegistry");
  assert.deepEqual(
    entries.map((e) => e.key),
    ["user", "sample"],
  );
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
  const replaced = upsertObjectEntry(text, { objectName: "serviceRegistry", key: "b", value: "3" });
  assert.match(replaced, /^  b: 3,$/m);
  const added = upsertObjectEntry(text, { objectName: "serviceRegistry", key: "c", value: "4" });
  assert.match(added, /  b: 2,\n  c: 4,\n\};/);
  const quoted = upsertObjectEntry(text, { objectName: "serviceRegistry", key: "a", value: "5" });
  assert.match(quoted, /^  a: 5,$/m);
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
  assert.equal(
    text,
    map.replace("  tag: tagConfig,\n", ""),
  );
});

test("removeObjectEntry: 無いキーは何も変えない・末尾カンマ無しの最後のエントリも消せる", () => {
  const text = `export const serviceRegistry = {
  a: 1,
  b: 2
};
`;
  assert.deepEqual(removeObjectEntry(text, { objectName: "serviceRegistry", key: "zz" }), { text, removed: false });
  const { text: out } = removeObjectEntry(text, { objectName: "serviceRegistry", key: "b" });
  assert.equal(out, "export const serviceRegistry = {\n  a: 1,\n};\n");
});

test("updateServiceRegistry: 複数行エントリを壊さず 1 行に置換し、import を重複させない", () => {
  const root = makeRoot({
    "src/registry/serviceRegistry.ts": SERVICE_REGISTRY.replace(
      'import { sampleService } from "@/features/sample/services/server/sampleService";',
      "import { sampleService } from '@/features/sample/services/server/sampleService';",
    ),
    "src/features/sample/domain.json": JSON.stringify({ apiAccess: API_ACCESS }),
  });
  updateServiceRegistry({ rootDir: root, camel: "sample" });
  const out = read(root, "src/registry/serviceRegistry.ts");
  assert.match(
    out,
    /\n  sample: \{ service: sampleService, access: \{"read":"public","write":\{"roleCategories":\["admin"\]\}\} \},\n  \/\/ --- AUTO-GENERATED-END ---/,
  );
  assert.equal(out.match(/sampleService } from/g).length, 1);
  assert.doesNotMatch(out, /^\s+service: sampleService,$/m);
});

test("updateSchemaRegistry: 引用符違いの既存 export を登録済みとみなす", () => {
  const original = `// --- AUTO-GENERATED-START ---
export * from '@/features/sample/entities/drizzle';
// --- AUTO-GENERATED-END ---
`;
  const root = makeRoot({ "src/registry/schemaRegistry.ts": original });
  updateSchemaRegistry({ rootDir: root, camel: "sample", dbEngine: "Neon" });
  assert.equal(read(root, "src/registry/schemaRegistry.ts"), original);
});

test("updateDomainConfigRegistry: 引用符・空白違いの既存 import / エントリを登録済みとみなす", () => {
  const original = `import sampleCategoryConfig from '@/features/sampleCategory/domain.json';

export const domainConfigRegistry = {
  // --- AUTO-GENERATED-START ---
  "sample_category":   sampleCategoryConfig,
  // --- AUTO-GENERATED-END ---
} as const;
`;
  const root = makeRoot({ "src/registry/domainConfigRegistry.ts": original });
  updateDomainConfigRegistry({ rootDir: root, camel: "sampleCategory" });
  assert.equal(read(root, "src/registry/domainConfigRegistry.ts"), original);
});

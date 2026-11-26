// pnpm generate domain のレジストリ更新（registry カテゴリ / objectEntry）と、登録表の access の組み方・字面への直し方
// (scripts/structure/registry/serviceRegistry/access.mjs)の回帰テスト。
// serviceRegistry.ts 自体の生成・検査は scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs（pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs）。
// 実行: pnpm test scripts/structure/domain/tests/registry.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeObjectEntry, scanObjectEntries, upsertObjectEntry } from "../text/objectEntry.mjs";
import { renderRegistry } from "../render/registry/index.mjs";
import { ACCESS_PRESETS, PRESET_RULES, buildGeneratedAccess, serializeAccess, serializeRule } from "../../registry/serviceRegistry/access.mjs";
import { domainTableName } from "../domain/names.mjs";
import { createWorkspace } from "../domain/workspace.mjs";

const SERVICE_REGISTRY = `import { userService } from "@/domains/core/user/services/server/userService";
import { sampleService } from "@/domains/sample/services/server/sampleService";

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

test("access.mjs: プリセットの写しが accessPresets.ts と一致する", async () => {
  const { tsImport } = await import("tsx/esm/api");
  const config = await tsImport(path.resolve(import.meta.dirname, "../../../../src/lib/domainAccess/index.ts"), import.meta.url);
  for (const [name, value] of Object.entries({ ...ACCESS_PRESETS, ...PRESET_RULES })) {
    assert.deepEqual(value, config[name], `${name} が TS 側と食い違っています`);
  }
});

test("registry カテゴリはドメインのフォルダの中だけを書く（core も business も）", () => {
  const config = { singular: "album", plural: "albums", dbEngine: "Neon", idType: "uuid", fields: [{ name: "cover", label: "表紙", fieldType: "mediaUploader", formInput: "mediaUploader", accept: "image/*", storage: { visibility: "public" } }] };
  const root = makeRoot({});
  for (const dir of ["src/domains/album", "src/domains/core/album"]) {
    const outputs = renderRegistry({ camel: "album", config, dir: path.join(root, dir), rel: dir }, createWorkspace(root));
    const paths = outputs.map((o) => o.path);
    assert.ok(paths.length >= 1);
    for (const p of paths) assert.ok(p.startsWith(path.join(root, dir) + path.sep), p);
    assert.ok(paths.some((p) => p.endsWith("services/server/storagePurposes.ts")));
    // 登録表の行は書かない(src/registry/serviceRegistry.ts は登録の entity.json から pnpm generate registry が作る)
    for (const p of paths) assert.match(p, /services\/server\/(collections|storagePurposes)\.ts$/, "registry カテゴリは collections.ts / storagePurposes.ts だけ");
  }
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

test("buildGeneratedAccess: apiAccess 未宣言は ADMIN_ONLY、truncateAll は管理者、export/import は useImportExport が true のときだけ管理者（書かなければ none）", () => {
  assert.deepEqual(buildGeneratedAccess(null), {
    ...ACCESS_PRESETS.ADMIN_ONLY,
    operations: { truncateAll: PRESET_RULES.ADMIN_RULE, export: "none", import: "none" },
  });
  const closed = buildGeneratedAccess({ apiAccess: API_ACCESS, useImportExport: false });
  assert.deepEqual(closed.operations, { truncateAll: PRESET_RULES.ADMIN_RULE, export: "none", import: "none" });
  const withOps = buildGeneratedAccess({ apiAccess: { ...API_ACCESS, operations: { update: "authenticated" } }, useImportExport: true });
  assert.equal(withOps.operations.update, "authenticated");
  assert.deepEqual(withOps.operations.export, PRESET_RULES.ADMIN_RULE);
});

test("domainTableName: 表の定義の生成器と同じ式（plural 優先、snake_case）", () => {
  assert.equal(domainTableName("sample", { plural: "samples" }), "samples");
  assert.equal(domainTableName("sampleTag", { plural: "sample_tags" }), "sample_tags");
  assert.equal(domainTableName("sampleTag", {}), "sample_tag");
  assert.equal(domainTableName("sample_tag", null), "sample_tag");
});

test("buildGeneratedAccess / serializeAccess: apiAccess.commands(データ操作のコマンドの上書き)は書いた時だけ access.commands に出る", () => {
  const without = buildGeneratedAccess({ apiAccess: { read: "public", write: { roleCategories: ["admin"] } } });
  assert.equal("commands" in without, false);
  const withCommands = buildGeneratedAccess({ apiAccess: { read: "public", write: { roleCategories: ["admin"] }, commands: { delete: "deny", export: "allow" } } });
  assert.deepEqual(withCommands.commands, { delete: "deny", export: "allow" });
  const { lines } = serializeAccess(buildGeneratedAccess({ apiAccess: { read: "public", write: { roleCategories: ["admin"] }, commands: { delete: "deny" } } }));
  assert.deepEqual(lines.slice(-3), ["commands: {", '  delete: "deny",', "},"]);
});

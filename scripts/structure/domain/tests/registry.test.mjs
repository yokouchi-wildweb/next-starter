// pnpm generate domain のレジストリ更新（registry カテゴリ / objectEntry の読み）と、登録表の access の組み方・字面への直し方
// (scripts/structure/registry/serviceRegistry/access.mjs)の回帰テスト。
// serviceRegistry.ts 自体の生成・検査は scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs（pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs）。
// 実行: pnpm test scripts/structure/domain/tests/registry.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanObjectEntries } from "../text/objectEntry.mjs";
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
    assert.ok(paths.some((p) => p.endsWith("StoragePurposes.ts")));
    // 登録表の行は書かない(src/registry/serviceRegistry.ts は登録の entity.json から pnpm generate registry が作る)
    for (const p of paths) assert.match(p, /services\/server\/[a-z][A-Za-z0-9]*(Collections|StoragePurposes)\.ts$/, "registry カテゴリは <登録名>Collections.ts / <登録名>StoragePurposes.ts だけ");
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

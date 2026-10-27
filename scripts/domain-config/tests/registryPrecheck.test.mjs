// 登録表（serviceRegistry.ts）の書く前の検査: これから書く domainEntry.ts を重ねた見え方で検査し、作れなければ何も書かない。
// 実行: pnpm test:dc-registry-precheck
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GENERATED_HEADER, createOverlayView, discoverDomainEntries } from "../../registry/serviceRegistry/discover.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { applyOutputs } from "../pipeline/apply.mjs";
import { overlayFromOutputs, precheckServiceRegistry } from "../pipeline/serviceRegistry.mjs";
import { file, writeOnce } from "../render/output.mjs";
import { renderDomainEntry } from "../render/registry/domainEntry.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const API_ACCESS = { read: "public", write: { roleCategories: ["admin"] } };

/** 登録表が空の最小リポ + foo（domain.json だけ） */
function project() {
  const root = makeProject({ configs: { foo: { singular: "foo", plural: "foos", dbEngine: "Neon", apiAccess: API_ACCESS } }, cleanup });
  fs.mkdirSync(path.join(root, "src", "registry"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "registry", "serviceRegistry.ts"), `${GENERATED_HEADER}\nexport const serviceRegistry: DomainRegistry = {\n};\n`);
  return root;
}

function plannedOutputs(root) {
  const serverDir = path.join(root, "src", "features", "foo", "services", "server");
  return [
    file(path.join(serverDir, "drizzleBase.ts"), "// base\n"),
    file(path.join(serverDir, "domainEntry.ts"), renderDomainEntry({ camel: "foo", config: { apiAccess: API_ACCESS, plural: "foos" } })),
    writeOnce(path.join(serverDir, "fooService.ts"), "// service\n"),
  ];
}

test("重ねた見え方: これから書く domainEntry.ts のキーが見え、ディスクには何も無い", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const overlay = overlayFromOutputs(plannedOutputs(root), workspace);
  const domains = discoverDomainEntries(root, createOverlayView(overlay));
  const foo = domains.find((d) => d.dir === "foo");
  assert.deepEqual(foo.keys, ["foo"]);
  assert.equal(foo.hasBase, true);
  assert.equal(fs.existsSync(path.join(root, "src", "features", "foo", "services", "server")), false);
  // 既存ファイルがある writeOnce は重ねない（既存が残るので見え方も既存）
  fs.mkdirSync(path.join(root, "src", "features", "foo", "services", "server"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "features", "foo", "services", "server", "fooService.ts"), "// hand\n");
  assert.equal(overlayFromOutputs(plannedOutputs(root), workspace).has(path.join(root, "src", "features", "foo", "services", "server", "fooService.ts")), false);
});

test("作れる状態なら通り、書いた後に registry:generate が同じ結論になる", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const outputs = plannedOutputs(root);
  assert.doesNotThrow(() => precheckServiceRegistry(workspace, outputs));
  applyOutputs(outputs, { log: () => {}, warn: () => {} });
  assert.deepEqual(discoverDomainEntries(root).find((d) => d.dir === "foo").keys, ["foo"]);
});

test("他のドメインに domainEntry.ts が無ければ、書く前に止まり何も書かない", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const barServer = path.join(root, "src", "features", "bar", "services", "server");
  fs.mkdirSync(barServer, { recursive: true });
  fs.writeFileSync(path.join(barServer, "drizzleBase.ts"), "// bar base\n");
  assert.throws(() => precheckServiceRegistry(workspace, plannedOutputs(root), { errorPrefix: "✗ " }), (err) => {
    assert.match(err.message, /^✗ src\/registry\/serviceRegistry\.ts を生成できません:\n/);
    assert.match(err.message, /src\/features\/bar\/services\/server に drizzleBase\.ts \/ firestoreBase\.ts があるのに domainEntry\.ts が無い/);
    return true;
  });
  assert.equal(fs.existsSync(path.join(root, "src", "features", "foo", "services", "server")), false, "何も書かれていない");
});
